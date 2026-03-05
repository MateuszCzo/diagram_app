import { DataSource } from 'typeorm';
import { Diagram } from '../diagram/diagram.entity';

export const AppDataSource = new DataSource({
  type:        'postgres',
  url:         process.env.DATABASE_URL,
  entities:    [Diagram],
  synchronize: process.env.NODE_ENV !== 'production',
  logging:     process.env.DB_LOGGING === 'true',
});