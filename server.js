import express from "express";
import { ApolloServer } from "apollo-server-express";
import cors from "cors";
import dotenv from "dotenv";
import typeDefs from "./graphql/schema.js";
import resolvers from "./graphql/resolvers.js";
import { connectMongo, connectNeo4j } from "./config/db.js";
import jwt from "jsonwebtoken";
import BlacklistedToken from "./models/BlacklistedToken.js";


dotenv.config();
const app = express();

const context = async ({ req }) => {
    const auth = req.headers.authorization || "";
    const token = auth.replace("Bearer ", "");
  
    if (!token) return { user: null };
  
    // 🛑 Check if token is blacklisted
    const isBlacklisted = await BlacklistedToken.findOne({ token });
    if (isBlacklisted) {
      throw new Error("Token is blacklisted");
    }
  
    try {
      const user = jwt.verify(token, process.env.JWT_SECRET);
      return { user ,req};
    } catch (err) {
      console.log("JWT verification failed:", err.message);
      return { user: null };
    }
  };

app.use(cors());
connectMongo();
connectNeo4j();

// const server = new ApolloServer({ typeDefs, resolvers });
const server = new ApolloServer({
    typeDefs,
    resolvers,
    context,
    // context: ({ req }) => {
    //     const token = req.headers.authorization?.split(" ")[1]; // safer way to extract
    //     console.log("Token:", token);
    //     if (!token) return {};
    //     try {
    //       const user = jwt.verify(token, process.env.JWT_SECRET);
    //       return { user };
    //     } catch (err) {
    //       console.error("JWT verification failed:", err.message);
    //       return {};
    //     }
    //   },
  });

await server.start();
server.applyMiddleware({ app });

app.listen(4000, () => console.log(`Server running at http://localhost:4000/graphql`));




