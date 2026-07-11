import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsAdminToUsers1783770274342 implements MigrationInterface {
  name = 'AddIsAdminToUsers1783770274342';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "isAdmin" boolean NOT NULL DEFAULT false`,
    );

    const initialAdminEmail = process.env.INITIAL_ADMIN_EMAIL;
    if (initialAdminEmail) {
      await queryRunner.query(
        `UPDATE "users" SET "isAdmin" = true WHERE "email" = $1`,
        [initialAdminEmail],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "isAdmin"`);
  }
}
