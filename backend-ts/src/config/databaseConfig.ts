import { DataSource } from "typeorm";
import { Project } from "../models/Project";

export const Database = new DataSource({
    type: "postgres",
    url: process.env.DATABASE_URL,
    entities: [
        Project
    ],
    synchronize: true,
    logging: true
});