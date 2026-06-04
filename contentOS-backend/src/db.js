// src/db.js
const { PrismaClient } = require("@prisma/client");
const logger = require("./logger");

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development"
    ? [{ emit: "event", level: "query" }]
    : ["error"],
});

if (process.env.NODE_ENV === "development") {
  prisma.$on("query", (e) => {
    logger.debug(`Query: ${e.query} | Duration: ${e.duration}ms`);
  });
}

module.exports = prisma;
