import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChangeRatingToFloat1783763405355 implements MigrationInterface {
  name = 'ChangeRatingToFloat1783763405355';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "watchlist" ALTER COLUMN "rating" TYPE double precision`,
    );
    await queryRunner.query(
      `ALTER TABLE "activity" ALTER COLUMN "rating" TYPE double precision`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "activity" ALTER COLUMN "rating" TYPE integer USING ROUND("rating")`,
    );
    await queryRunner.query(
      `ALTER TABLE "watchlist" ALTER COLUMN "rating" TYPE integer USING ROUND("rating")`,
    );
  }
}
