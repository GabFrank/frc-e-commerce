import gql from 'graphql-tag';

const commonTypes = gql`
  extend type Query {
    tenantBySubdomain(subdomain: String!): Channel
  }
`;

export const adminSchema = gql`
  ${commonTypes}

  extend type Query {
    tenants: [Channel!]!
  }
`;

export const shopSchema = gql`
  ${commonTypes}
`;
