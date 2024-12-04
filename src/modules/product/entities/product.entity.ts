import { IsNotEmpty } from 'class-validator';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: false })
  @IsNotEmpty()
  product_name: string;

  @Column({ nullable: false })
  @IsNotEmpty()
  description: string;

  @Column({ nullable: true })
  stock?: number;
}
