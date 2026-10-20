import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bootstrap migration. The actual table DDL is generated automatically the
 * first time you run `npm run db:migrate:generate`. This stub installs
 * driver-specific bootstrap requirements (currently only PostgreSQL needs
 * the uuid-ossp / pgcrypto extensions) and guarantees a valid migration
 * history exists for every supported engine.
 */
export class Initial1700000000000 implements MigrationInterface {
  public async up(qr: QueryRunner): Promise<void> {
    const driver = qr.connection.options.type;
    if (driver === 'postgres') {
      await qr.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
      await qr.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    }
    // SQLite, MSSQL/Azure SQL, MySQL, MariaDB and Oracle ship UUID + JSON
    // helpers natively or have them emulated by TypeORM — no setup required.
  }

  public async down(qr: QueryRunner): Promise<void> {
    const driver = qr.connection.options.type;
    if (driver === 'postgres') {
      await qr.query(`DROP EXTENSION IF EXISTS "pgcrypto"`);
      await qr.query(`DROP EXTENSION IF EXISTS "uuid-ossp"`);
    }
  }
}
