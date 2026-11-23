import { Request, Response } from 'express';
import { parse } from 'csv-parse/sync';

export class UploadController {
  /**
   * POST /api/upload/csv
   * Parse a CSV/text file and extract email addresses.
   */
  async parseCSV(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      const content = req.file.buffer.toString('utf-8');
      const emails: string[] = [];

      // Try parsing as CSV first
      try {
        const records = parse(content, {
          skip_empty_lines: true,
          trim: true,
          relax_column_count: true,
        });

        for (const row of records) {
          for (const cell of row) {
            const emailMatch = String(cell).match(/[\w.-]+@[\w.-]+\.\w+/g);
            if (emailMatch) {
              emails.push(...emailMatch);
            }
          }
        }
      } catch {
        // If CSV parsing fails, try line-by-line email extraction
        const lines = content.split(/[\n\r,;]+/);
        for (const line of lines) {
          const emailMatch = line.trim().match(/[\w.-]+@[\w.-]+\.\w+/g);
          if (emailMatch) {
            emails.push(...emailMatch);
          }
        }
      }

      // Deduplicate
      const uniqueEmails = [...new Set(emails.map(e => e.toLowerCase()))];

      res.json({
        total: uniqueEmails.length,
        emails: uniqueEmails,
      });
    } catch (error) {
      console.error('CSV parse error:', error);
      res.status(500).json({ error: 'Failed to parse file' });
    }
  }
}

export const uploadController = new UploadController();
