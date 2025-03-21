import mongoose from "mongoose";
import neo4j from "neo4j-driver";
import dotenv from "dotenv";

dotenv.config();

// MongoDB Connection
export const connectMongo = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB Connected");
  } catch (err) {
    console.error("MongoDB Error:", err);
  }
};

// Neo4j Connection
export const neo4jDriver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
);

export const connectNeo4j = async () => {
  try {
    await neo4jDriver.verifyConnectivity();
    console.log("Neo4j Connected");
  } catch (err) {
    console.error(" Neo4j Error:", err);
  }
};
