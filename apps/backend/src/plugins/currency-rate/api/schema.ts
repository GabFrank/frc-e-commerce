import gql from 'graphql-tag';

const commonSchema = gql`
  type CurrencyRate implements Node {
    id: ID!
    createdAt: DateTime!
    updatedAt: DateTime!
    fromCurrency: CurrencyCode!
    toCurrency: CurrencyCode!
    rate: Float!
    effectiveAt: DateTime!
    channelId: ID
  }

  extend type Query {
    currencyRates: [CurrencyRate!]!
  }
`;

export const adminSchema = gql`
  ${commonSchema}

  input CreateCurrencyRateInput {
    fromCurrency: CurrencyCode!
    toCurrency: CurrencyCode!
    rate: Float!
    effectiveAt: DateTime
    channelId: ID
  }

  extend type Mutation {
    createCurrencyRate(input: CreateCurrencyRateInput!): CurrencyRate!
  }
`;

export const shopSchema = gql`
  ${commonSchema}
`;
