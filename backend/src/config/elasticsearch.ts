import { Client } from '@elastic/elasticsearch';
import { config } from './env';

export const esClient = new Client({
  node: config.elasticsearchUrl,
});

const EMAIL_INDEX = 'emails';

export async function initElasticsearch() {
  try {
    const indexExists = await esClient.indices.exists({ index: EMAIL_INDEX });
    if (!indexExists) {
      await esClient.indices.create({
        index: EMAIL_INDEX,
        body: {
          mappings: {
            properties: {
              id: { type: 'keyword' },
              user_id: { type: 'keyword' },
              sender_email: { type: 'keyword' },
              recipient_email: { type: 'keyword' },
              subject: { type: 'text', analyzer: 'standard' },
              body: { type: 'text', analyzer: 'standard' },
              status: { type: 'keyword' },
              scheduled_at: { type: 'date' },
              sent_at: { type: 'date' },
              batch_id: { type: 'keyword' },
              created_at: { type: 'date' },
            },
          },
        },
      });
      console.log('Elasticsearch index "emails" created.');
    }
    console.log('Elasticsearch connected.');
  } catch (error) {
    console.error('Elasticsearch initialization error:', error);
    // Don't crash — ES is optional for core functionality
  }
}

export async function indexEmail(email: Record<string, unknown>) {
  try {
    await esClient.index({
      index: EMAIL_INDEX,
      id: email.id as string,
      body: email,
    });
  } catch (error) {
    console.error('Failed to index email in Elasticsearch:', error);
  }
}

export async function searchEmails(params: {
  query?: string;
  status?: string;
  sender_email?: string;
  user_id: string;
  from_date?: string;
  to_date?: string;
  page?: number;
  limit?: number;
}) {
  const { query, status, sender_email, user_id, from_date, to_date, page = 1, limit = 20 } = params;

  const must: Record<string, unknown>[] = [
    { term: { user_id } },
  ];

  if (query) {
    must.push({
      multi_match: {
        query,
        fields: ['subject', 'body', 'recipient_email', 'sender_email'],
        type: 'best_fields',
        fuzziness: 'AUTO',
      },
    });
  }

  if (status) {
    must.push({ term: { status } });
  }

  if (sender_email) {
    must.push({ term: { sender_email } });
  }

  if (from_date || to_date) {
    const range: Record<string, string> = {};
    if (from_date) range.gte = from_date;
    if (to_date) range.lte = to_date;
    must.push({ range: { scheduled_at: range } });
  }

  try {
    const result = await esClient.search({
      index: EMAIL_INDEX,
      body: {
        query: { bool: { must } },
        sort: [{ scheduled_at: { order: 'desc' } }],
        from: (page - 1) * limit,
        size: limit,
      },
    });

    const hits = result.hits.hits.map((hit: Record<string, unknown>) => ({
      ...(hit._source as Record<string, unknown>),
      _score: hit._score,
    }));

    const total = typeof result.hits.total === 'number'
      ? result.hits.total
      : (result.hits.total as { value: number })?.value || 0;

    return { data: hits, total, page, limit, totalPages: Math.ceil(total / limit) };
  } catch (error) {
    console.error('Elasticsearch search error:', error);
    return { data: [], total: 0, page, limit, totalPages: 0 };
  }
}

export async function updateEmailIndex(id: string, fields: Record<string, unknown>) {
  try {
    await esClient.update({
      index: EMAIL_INDEX,
      id,
      body: { doc: fields },
    });
  } catch (error) {
    console.error('Failed to update email in Elasticsearch:', error);
  }
}
