import { DataSource } from 'typeorm';
import { Seeder } from 'typeorm-extension';
import insertDataWithPrimaryKeyId from '../../../orm.config';
import { Product } from '../entities/product.entity';

export default class CreateProducts implements Seeder {
  public async run(dataSource: DataSource): Promise<void> {
    const products = [
      {
        id: 1,
        product_name: 'Apple',
        description: 'Test the apple',
        stock: 3,
      } as Product,
      {
        id: 2,
        product_name: 'Onion',
        description: 'Test the onion',
        stock: 5,
      } as Product,
    ];

    await insertDataWithPrimaryKeyId(products, dataSource, Product);
  }
}
