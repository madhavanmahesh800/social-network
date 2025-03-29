import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Profile from "../models/Profile.js";
import Message from "../models/Message.js";
import { neo4jDriver } from "../config/db.js";
import BlacklistedToken from '../models/BlacklistedToken.js';

const generateToken = (username) => jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: "7d" });

// export default {
//   Query: {
//     async getUserProfile(_, { username }) {
//       return await Profile.findOne({ username });
//     },

//     async getFollowers(_, { username }) {
//       const session = neo4jDriver.session();
//       const result = await session.run(
//         "MATCH (u:User {username: $username})<-[:FOLLOWS]-(f) RETURN f.username",
//         { username }
//       );
//       session.close();
//       return result.records.map((record) => record.get("f.username"));
//     },

//     async getFollowing(_, { username }) {
//       const session = neo4jDriver.session();
//       const result = await session.run(
//         "MATCH (u:User {username: $username})-[:FOLLOWS]->(f) RETURN f.username",
//         { username }
//       );
//       session.close();
//       return result.records.map((record) => record.get("f.username"));
//     },

//     async getMessages(_, { username }) {
//       const profile = await Profile.findOne({ username });
//       return await Message.find({ owner: profile._id }).populate("owner");
//     },
//   },

//   Mutation: {
//     async register(_, { username, password }) {
//       const hashedPassword = await bcrypt.hash(password, 10);
//       const profile = new Profile({ username });
//       await profile.save();

//       const session = neo4jDriver.session();
//       await session.run("CREATE (u:User {username: $username})", { username });
//       session.close();

//       return generateToken(username);
//     },

//     async login(_, { username, password }) {
//       const profile = await Profile.findOne({ username });
//       if (!profile) throw new Error("User not found");
//       return generateToken(username);
//     },

//     logout: () => {
//       return "Logged out successfully"; // Client should remove the token
//     },

//     async followUser(_, { username, target }) {
//       const session = neo4jDriver.session();
//       await session.run(
//         "MATCH (a:User {username: $username}), (b:User {username: $target}) CREATE (a)-[:FOLLOWS]->(b)",
//         { username, target }
//       );
//       session.close();
//       return "Followed successfully";
//     },

//     async unfollowUser(_, { username, target }) {
//       const session = neo4jDriver.session();
//       await session.run(
//         "MATCH (a:User {username: $username})-[r:FOLLOWS]->(b:User {username: $target}) DELETE r",
//         { username, target }
//       );
//       session.close();
//       return "Unfollowed successfully";
//     },

//     async sendMessage(_, { username, message }) {
//       const profile = await Profile.findOne({ username });
//       const newMessage = new Message({ owner: profile._id, message });
//       return await newMessage.save();
//     },

//     async deleteMessage(_, { username, messageId }) {
//       const profile = await Profile.findOne({ username });
//       const message = await Message.findOne({ _id: messageId, owner: profile._id });
//       if (!message) throw new Error("Message not found");
//       await message.deleteOne();
//       return "Message deleted";
//     },
//   },
// };
export default {
  Query: {
    async getUserProfile(_, { username }) {
      return await Profile.findOne({ username });
    },
  
    async getFollowers(_, __, context) {
      const username = context.user?.username;
      if (!username) throw new Error("Unauthorized");
  
      const session = neo4jDriver.session();
      const result = await session.run(
        "MATCH (u:User {username: $username})<-[:FOLLOWS]-(f) RETURN f.username",
        { username }
      );
      session.close();
      return result.records.map((r) => r.get("f.username"));
    },
  
    async getFollowing(_, __, context) {
      const username = context.user?.username;
      if (!username) throw new Error("Unauthorized");
  
      const session = neo4jDriver.session();
      const result = await session.run(
        "MATCH (u:User {username: $username})-[:FOLLOWS]->(f) RETURN f.username",
        { username }
      );
      session.close();
      return result.records.map((r) => r.get("f.username"));
    },
  
    async getMessages(_, __, context) {
      const username = context.user?.username;
      if (!username) throw new Error("Unauthorized");
  
      const profile = await Profile.findOne({ username });
      return await Message.find({ owner: profile._id }).populate("owner");
    },

    async getRecommendations(_, __, context) {
      // Get the current user's username from the context
      const currentUsername = context.user?.username;
      if (!currentUsername) throw new Error("Unauthorized");

      const session = neo4jDriver.session();
      try {
        // Cypher query to find recommended users
        const result = await session.run(
          `
          MATCH (current:User {username: $currentUsername})-[:FOLLOWS]->(followed:User)<-[:FOLLOWS]-(rec:User)
          WHERE NOT (rec)-[:FOLLOWS]->(current)
            AND NOT (current)-[:FOLLOWS]->(rec)
            AND rec <> current
          RETURN rec.username AS username, count(followed) AS mutualCount
          ORDER BY mutualCount DESC
          LIMIT 5
          `,
          { currentUsername }
        );

        // Extract usernames from the query result
        const recommendedUsernames = result.records.map(record => record.get("username"));

        // Fetch profiles from MongoDB
        const recommendedProfiles = await Profile.find({ username: { $in: recommendedUsernames } });

        return recommendedProfiles;
      } finally {
        session.close();
      }
    },

  },
  
  Mutation: {
    async register(_, { username, password }) {
      const existing = await Profile.findOne({ username });
      if (existing) throw new Error("Username already taken");

      const hash = await bcrypt.hash(password, 10);
      const newProfile = new Profile({ username, password: hash });
      await newProfile.save();

      // Add to Neo4j too
      const session = neo4jDriver.session();
      await session.run(
        "CREATE (u:User {username: $username})",
        { username }
      );
      await session.close();

      return "Registration successful";
    },

    async login(_, { username, password }) {
      const profile = await Profile.findOne({ username });
      if (!profile) throw new Error("User not found");

      const match = await bcrypt.compare(password, profile.password);
      if (!match) throw new Error("Invalid credentials");

      const token = generateToken(username);
      return token;  // returned to client
    },

    async logout(_, __, context) {
      const auth = context.req.headers.authorization || "";
      const token = auth.replace("Bearer ", "");
  
      if (!token) return "No token found";
  
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const alreadyBlacklisted = await BlacklistedToken.findOne({ token });
        if (alreadyBlacklisted) return "Already logged out";
        
        await BlacklistedToken.create({
          token,
          expiresAt: new Date(decoded.exp * 1000),
        });
  
        return "Logout successful";
      } catch (err) {
        return "Invalid token";
      }
    },

    async updateProfile(_, { profile_photo, description }, context) {
      const username = context.user?.username;
      if (!username) throw new Error("Not authenticated");
  
      return await Profile.findOneAndUpdate(
        { username },
        { profile_photo, description },
        { new: true }
      );
    },
  
    async followUser(_, { target }, context) {
    const username = context.user?.username;
    if (!username) throw new Error("Unauthorized");

    if (username === target) {
      throw new Error("You cannot follow yourself");
    }

    const session = neo4jDriver.session();

    // Check if relationship already exists
    const checkResult = await session.run(
      `
        MATCH (a:User {username: $username})-[r:FOLLOWS]->(b:User {username: $target})
        RETURN r
      `,
      { username, target }
    );

    if (checkResult.records.length > 0) {
      await session.close();
      return "Already following";
  ``}

    // Create follow relationship if it doesn't exist
    await session.run(
      `
        MATCH (a:User {username: $username}), (b:User {username: $target})
        CREATE (a)-[:FOLLOWS]->(b)
      `,
      { username, target }
    );

    await session.close();
    return "Followed successfully";
  },
  
    async unfollowUser(_, { target }, context) {
      const username = context.user?.username;
      if (!username) throw new Error("Unauthorized");
  
      const session = neo4jDriver.session();
      await session.run(
        "MATCH (a:User {username: $username})-[r:FOLLOWS]->(b:User {username: $target}) DELETE r",
        { username, target }
      );
      session.close();
      return "Unfollowed successfully";
    },
  
    async sendMessage(_, { message }, context) {
      const username = context.user?.username;
      if (!username) throw new Error("Unauthorized");
  
      const profile = await Profile.findOne({ username });
      const newMessage = new Message({ owner: profile._id, message });
      return await newMessage.save();
    },
  
    async deleteMessage(_, { messageId }, context) {
      const username = context.user?.username;
      if (!username) throw new Error("Unauthorized");
  
      const profile = await Profile.findOne({ username });
      const message = await Message.findOne({
        _id: messageId,
        owner: profile._id,
      });
      if (!message) throw new Error("Message not found");
      await message.deleteOne();
      return "Message deleted";
    },
  }
};


