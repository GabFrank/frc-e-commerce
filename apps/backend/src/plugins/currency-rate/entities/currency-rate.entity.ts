import { CurrencyCode, DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity, Index } from 'typeorm';

@Entity()
@Index(['fromCurrency', 'toCurrency', 'effectiveAt'])
export class CurrencyRate extends VendureEntity {
  constructor(input?: DeepPartial<CurrencyRate>) {
    super(input);
  }

  @Column('varchar')
  fromCurrency!: CurrencyCode;

  @Column('varchar')
  toCurrency!: CurrencyCode;

  @Column('decimal', { precision: 18, scale: 8 })
  rate!: number;

  @Column()
  effectiveAt!: Date;

  @Column({ nullable: true })
  channelId?: string;
}
