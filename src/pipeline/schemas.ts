export const finalJsonSchema = {
  type: 'object',
  required: ['title', 'description', 'content'],
  additionalProperties: false,
  properties: {
    title: { type: 'string', maxLength: 100 },
    description: {
      type: 'string',
      maxLength: 200,
      pattern: '^[^#*_`]*$'
    },
    content: { type: 'string', minLength: 800 }
  }
} as const;

export type FinalJsonSchema = typeof finalJsonSchema;
