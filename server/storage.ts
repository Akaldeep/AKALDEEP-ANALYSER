import { db } from "./db";
import { searches, companyProfiles, type InsertSearch, type Search, type InsertCompanyProfile, type CompanyProfile } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface IStorage {
  createSearch(search: InsertSearch): Promise<Search>;
  getRecentSearches(): Promise<Search[]>;
  getCompanyProfile(ticker: string): Promise<CompanyProfile | undefined>;
  upsertCompanyProfile(profile: InsertCompanyProfile): Promise<CompanyProfile>;
}

export class DatabaseStorage implements IStorage {
  async createSearch(search: InsertSearch): Promise<Search> {
    const [newSearch] = await db.insert(searches).values(search).returning();
    return newSearch;
  }

  async getRecentSearches(): Promise<Search[]> {
    return await db.select().from(searches).orderBy(searches.createdAt).limit(10);
  }

  async getCompanyProfile(ticker: string): Promise<CompanyProfile | undefined> {
    const [profile] = await db.select().from(companyProfiles).where(eq(companyProfiles.ticker, ticker));
    return profile;
  }

  async upsertCompanyProfile(profile: InsertCompanyProfile): Promise<CompanyProfile> {
    const [upserted] = await db
      .insert(companyProfiles)
      .values(profile)
      .onConflictDoUpdate({
        target: companyProfiles.ticker,
        set: {
          keywords: profile.keywords,
          embedding: profile.embedding,
          updatedAt: new Date(),
        },
      })
      .returning();
    return upserted;
  }
}

export const storage = new DatabaseStorage();
