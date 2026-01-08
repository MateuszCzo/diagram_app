import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity()
export class Project {
    @PrimaryColumn()
    public id!: string;

    @Column()
    public name!: string;

    @Column({ type: 'text' })
    public snapshot!: string;
}