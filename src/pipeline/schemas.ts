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

export const outlineJsonSchema = {
  type: 'object',
  required: ['finalTitle', 'description', 'sections', 'guardrails'],
  additionalProperties: false,
  properties: {
    finalTitle: { type: 'string', maxLength: 100 },
    description: { type: 'string', maxLength: 200, pattern: '^[^#*_`]*$' },
    sections: {
      type: 'array',
      minItems: 4,
      maxItems: 4,
      items: {
        type: 'object',
        required: ['h2', 'bullets'],
        additionalProperties: false,
        properties: {
          h2: { type: 'string' },
          bullets: {
            type: 'array',
            minItems: 2,
            maxItems: 3,
            items: { type: 'string' },
          },
        },
      },
    },
    guardrails: {
      type: 'array',
      minItems: 3,
      maxItems: 6,
      items: { type: 'string' },
    },
  },
} as const;

export type OutlineJsonSchema = typeof outlineJsonSchema;
