import mongoose from "mongoose";
import dns from "dns";

const connectDB = async () => {
  try {
    // Set fallback public DNS servers for resolving MongoDB Atlas SRV records
    // on networks where default DNS resolution fails (e.g. IPv6-only DNS issues on Windows)
    dns.setServers(["8.8.8.8", "8.8.4.4"]);
    
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

export default connectDB;