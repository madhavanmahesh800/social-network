import { gql } from "apollo-server-express";

export default gql`
  type Profile {
    _id: ID!
    username: String!
    profile_photo: String
    description: String
  }

  type Message {
    _id: ID!
    owner: Profile!
    message: String!
    timestamp: String!
  }

  type User {
    id: ID!
    username: String!
    following: [String]
    followers: [String]
  }

  type Query {
    getUserProfile(username: String!): Profile
    getFollowers(username: String!): [String]
    getFollowing(username: String!): [String]
    getMessages(username: String!): [Message]
    getRecommendations: [Profile]
  }

  type Mutation {
    register(username: String!, password: String!): String
    login(username: String!, password: String!): String
    updateProfile( profile_photo: String, description: String): Profile
    followUser( target: String!): String
    unfollowUser( target: String!): String
    sendMessage( message: String!): Message
    deleteMessage( messageId: ID!): String
    logout: String
  }
`;
