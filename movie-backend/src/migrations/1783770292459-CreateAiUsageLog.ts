import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAiUsageLog1783770292459 implements MigrationInterface {
  name = 'CreateAiUsageLog1783770292459';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "ai_usage_log" (
        "id" SERIAL PRIMARY KEY,
        "userId" integer NOT NULL,
        "provider" varchar NOT NULL,
        "wasFailover" boolean NOT NULL DEFAULT false,
        "requestType" varchar NOT NULL,
        "tokenCount" integer,
        "latencyMs" integer,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_ai_usage_log_createdAt" ON "ai_usage_log" ("createdAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "ai_usage_log"`);
  }
}
