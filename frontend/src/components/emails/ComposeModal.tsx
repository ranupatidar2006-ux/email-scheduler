import { useState, useRef } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input, TextArea } from '../ui/Input';
import { uploadCSV, scheduleEmails } from '../../services/api';
import toast from 'react-hot-toast';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ComposeModal({ isOpen, onClose, onSuccess }: ComposeModalProps) {
  const [senderEmail, setSenderEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [startTime, setStartTime] = useState('');
  const [delayMs, setDelayMs] = useState(2000);
  const [hourlyLimit, setHourlyLimit] = useState(50);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const result = await uploadCSV(file);
      setRecipients(result.emails);
      toast.success(`${result.total} email addresses detected`);
    } catch {
      toast.error('Failed to parse file');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!senderEmail || !subject || !body || recipients.length === 0 || !startTime) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    try {
      const result = await scheduleEmails({
        sender_email: senderEmail,
        subject,
        body,
        recipients,
        start_time: new Date(startTime).toISOString(),
        delay_between_emails_ms: delayMs,
        hourly_limit: hourlyLimit,
      });

      toast.success(result.message);
      onSuccess();
      resetForm();
      onClose();
    } catch {
      toast.error('Failed to schedule emails');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSenderEmail('');
    setSubject('');
    setBody('');
    setRecipients([]);
    setStartTime('');
    setDelayMs(2000);
    setHourlyLimit(50);
  };

  // Min datetime for the picker: now
  const minDateTime = new Date().toISOString().slice(0, 16);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Compose New Email" size="lg">
      <div className="space-y-4">
        <Input
          label="Sender Email *"
          type="email"
          placeholder="sender@example.com"
          value={senderEmail}
          onChange={(e) => setSenderEmail(e.target.value)}
        />

        <Input
          label="Subject *"
          type="text"
          placeholder="Your email subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />

        <TextArea
          label="Body *"
          placeholder="Write your email content here (HTML supported)..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
        />

        {/* CSV Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Upload Leads (CSV/TXT) *
          </label>
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              loading={uploading}
            >
              {uploading ? 'Parsing...' : 'Choose File'}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt,.tsv"
              onChange={handleFileUpload}
              className="hidden"
            />
            {recipients.length > 0 && (
              <span className="text-sm text-green-600 font-medium">
                ✓ {recipients.length} email{recipients.length !== 1 ? 's' : ''} detected
              </span>
            )}
          </div>
        </div>

        {/* Schedule Settings */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            label="Start Time *"
            type="datetime-local"
            min={minDateTime}
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
          <Input
            label="Delay Between Emails (ms)"
            type="number"
            min={500}
            step={500}
            value={delayMs}
            onChange={(e) => setDelayMs(parseInt(e.target.value) || 2000)}
          />
          <Input
            label="Hourly Limit (per sender)"
            type="number"
            min={1}
            value={hourlyLimit}
            onChange={(e) => setHourlyLimit(parseInt(e.target.value) || 50)}
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={submitting}>
            Schedule {recipients.length > 0 ? `(${recipients.length} emails)` : ''}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
