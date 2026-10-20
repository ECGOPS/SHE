import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';
import { buildTypeOrmOptions } from './database.config';
import { AuditColumnsSubscriber } from './audit-columns.subscriber';
import { AuditLogImmutableSubscriber } from '../modules/audit-trail/audit-log.immutable';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config();

const opts = buildTypeOrmOptions(new ConfigService(process.env)) as DataSourceOptions;

export const AppDataSource = new DataSource({
  ...opts,
  entities: [path.join(__dirname, '..', '**', '*.entity.{ts,js}')],
  migrations: [path.join(__dirname, 'migrations', '*.{ts,js}')],
  subscribers: [AuditColumnsSubscriber, AuditLogImmutableSubscriber],
});
