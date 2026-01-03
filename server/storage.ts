import { db } from "./db";
import { searches, type InsertSearch, type Search } from "@shared/schema";

export interface IStorage {
  createSearch(search: InsertSearch): Promise<Search>;
  getRecentSearches(): Promise<Search[]>;
}

export class DatabaseStorage implements IStorage {
  async createSearch(search: InsertSearch): Promise<Search> {
    const [newSearch] = await db.insert(searches).values(search).returning();
    return newSearch;
  }

  async getRecentSearches(): Promise<Search[]> {
    return await db.select().from(searches).orderBy(searches.createdAt).limit(10);
  }
}

export const storage = new DatabaseStorage();
