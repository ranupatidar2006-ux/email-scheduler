import { useState, useEffect, useCallback } from 'react';
import type { User, Email, PaginatedResponse, SlackStatus } from '../types';
import { Header } from '../components/layout/Header';
import { EmailTable } from '../components/emails/EmailTable';
import { ComposeModal } from '../components/emails/ComposeModal';
import { SearchBar } from '../components/emails/SearchBar';
import { Pagination } from '../components/emails/Pagination';
import { Button } from '../components/ui/Button';
import { getScheduledEmails, getSentEmails, searchEmails, getSlackConnectUrl, getSlackStatus, disconnectSlack } from '../services/api';
import toast from 'react-hot-toast';

interface DashboardPageProps {
  user: User;
  onLogout: () => void;
}

type Tab = 'scheduled' | 'sent';

export function DashboardPage({ user, onLogout }: DashboardPageProps) {
  const [activeTab, setActiveTab] = useState<Tab>('scheduled');
  const [composeOpen, setComposeOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Scheduled emails state
  const [scheduled, setScheduled] = useState<PaginatedResponse<Email>>({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 });
  const [scheduledLoading, setScheduledLoading] = useState(false);

  // Sent emails state
  const [sent, setSent] = useState<PaginatedResponse<Email>>({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 });
  const [sentLoading, setSentLoading] = useState(false);

  // Search state
  const [searchResults, setSearchResults] = useState<PaginatedResponse<Email> | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  // Slack state
  const [slackStatus, setSlackStatus] = useState<SlackStatus>({ connected: false });

  const fetchScheduled = useCallback(async (page = 1) => {
    setScheduledLoading(true);
    try {
      const result = await getScheduledEmails(page);
      setScheduled(result);
    } catch {
      toast.error('Failed to load scheduled emails');
    } finally {
      setScheduledLoading(false);
    }
  }, []);

  const fetchSent = useCallback(async (page = 1) => {
    setSentLoading(true);
    try {
      const result = await getSentEmails(page);
      setSent(result);
    } catch {
      toast.error('Failed to load sent emails');
    } finally {
      setSentLoading(false);
    }
  }, []);

  const fetchSlackStatus = useCallback(async () => {
    try {
      const status = await getSlackStatus();
      setSlackStatus(status);
    } catch {
      // Silently ignore
    }
  }, []);

  useEffect(() => {
    fetchScheduled();
    fetchSent();
    fetchSlackStatus();

    // Check for Slack callback result
    const params = new URLSearchParams(window.location.search);
    if (params.get('slack') === 'connected') {
      toast.success('Slack connected successfully!');
      fetchSlackStatus();
      window.history.replaceState({}, '', '/dashboard');
    } else if (params.get('slack') === 'error') {
      toast.error('Failed to connect Slack');
      window.history.replaceState({}, '', '/dashboard');
    }
  }, [fetchScheduled, fetchSent, fetchSlackStatus]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (activeTab === 'scheduled') fetchScheduled(scheduled.page);
      else fetchSent(sent.page);
    }, 30000);
    return () => clearInterval(interval);
  }, [activeTab, scheduled.page, sent.page, fetchScheduled, fetchSent]);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }
    setSearchLoading(true);
    try {
      const result = await searchEmails({
        query,
        status: activeTab === 'scheduled' ? 'scheduled' : undefined,
      });
      setSearchResults(result);
    } catch {
      toast.error('Search failed');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSlackConnect = async () => {
    try {
      const { url } = await getSlackConnectUrl();
      window.location.href = url;
    } catch {
      toast.error('Failed to get Slack connect URL');
    }
  };

  const handleSlackDisconnect = async () => {
    try {
      await disconnectSlack();
      setSlackStatus({ connected: false });
      toast.success('Slack disconnected');
    } catch {
      toast.error('Failed to disconnect Slack');
    }
  };

  const displayData = searchResults || (activeTab === 'scheduled' ? scheduled : sent);
  const isLoading = searchLoading || (activeTab === 'scheduled' ? scheduledLoading : sentLoading);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header user={user} onLogout={onLogout} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Top Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">Manage your email campaigns</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Slack Connect */}
            {slackStatus.connected ? (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-sm text-green-600">
                  <span className="w-2 h-2 bg-green-500 rounded-full" />
                  Slack: {slackStatus.integration?.slack_team_name}
                </span>
                <Button variant="ghost" size="sm" onClick={handleSlackDisconnect}>
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button variant="secondary" size="md" onClick={handleSlackConnect}>
                <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
                </svg>
                Connect Slack
              </Button>
            )}

            <Button onClick={() => setComposeOpen(true)}>
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Compose New Email
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <SearchBar
            onSearch={handleSearch}
            placeholder="Search emails by recipient, subject, or body (Elasticsearch)..."
          />
          {searchQuery && searchResults && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm text-gray-500">
                {searchResults.total} results for "{searchQuery}"
              </span>
              <button
                onClick={() => { setSearchQuery(''); setSearchResults(null); }}
                className="text-sm text-primary-600 hover:underline"
              >
                Clear search
              </button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'scheduled'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                onClick={() => { setActiveTab('scheduled'); setSearchResults(null); setSearchQuery(''); }}
              >
                Scheduled ({scheduled.total})
              </button>
              <button
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'sent'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                onClick={() => { setActiveTab('sent'); setSearchResults(null); setSearchQuery(''); }}
              >
                Sent ({sent.total})
              </button>
            </nav>
          </div>

          {/* Table */}
          <EmailTable
            emails={displayData.data}
            loading={isLoading}
            showSentTime={activeTab === 'sent'}
            emptyTitle={activeTab === 'scheduled' ? 'No scheduled emails' : 'No sent emails'}
            emptyDescription={
              activeTab === 'scheduled'
                ? 'Schedule your first email campaign by clicking "Compose New Email"'
                : 'Emails will appear here once they are sent'
            }
          />

          {/* Pagination */}
          <Pagination
            page={displayData.page}
            totalPages={displayData.totalPages}
            total={displayData.total}
            onPageChange={(p) => {
              if (searchResults) {
                handleSearch(searchQuery);
              } else if (activeTab === 'scheduled') {
                fetchScheduled(p);
              } else {
                fetchSent(p);
              }
            }}
          />
        </div>
      </main>

      {/* Compose Modal */}
      <ComposeModal
        isOpen={composeOpen}
        onClose={() => setComposeOpen(false)}
        onSuccess={() => {
          fetchScheduled();
          fetchSent();
        }}
      />
    </div>
  );
}
