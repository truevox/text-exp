/**
 * Setup script to populate Chrome extension with test snippets
 * Run this in the extension's console to add sample data for testing
 */

// Sample snippets for testing
const SAMPLE_SNIPPETS = [
  {
    id: 'greeting-hello',
    trigger: ';hello',
    content: 'Hello! How are you doing today?',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    variables: [],
    tags: ['greeting', 'casual']
  },
  {
    id: 'greeting-goodbye',
    trigger: ';gb',
    content: 'Goodbye! Have a great day!',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    variables: [],
    tags: ['greeting', 'farewell']
  },
  {
    id: 'email-signature',
    trigger: ';sig',
    content: `Best regards,
{name}
{title}
{company}`,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    variables: [
      { name: 'name', placeholder: 'Your name', required: true, type: 'text' },
      { name: 'title', placeholder: 'Your job title', required: true, type: 'text' },
      { name: 'company', placeholder: 'Company name', required: true, type: 'text' }
    ],
    tags: ['email', 'signature', 'professional']
  },
  {
    id: 'meeting-invite',
    trigger: ';meeting',
    content: `Hi {name},

I'd like to schedule a meeting to discuss {topic}. 

Would {date} at {time} work for you? The meeting will be about {duration} long.

Let me know if you need to reschedule.

Thanks!`,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    variables: [
      { name: 'name', placeholder: 'Recipient name', required: true, type: 'text' },
      { name: 'topic', placeholder: 'Meeting topic', required: true, type: 'text' },
      { name: 'date', placeholder: 'Meeting date', required: true, type: 'date' },
      { name: 'time', placeholder: 'Meeting time', required: true, type: 'time' },
      { name: 'duration', placeholder: 'Duration (e.g. 30 minutes)', required: true, type: 'text' }
    ],
    tags: ['meeting', 'professional', 'scheduling']
  },
  {
    id: 'code-snippet',
    trigger: ';log',
    content: 'console.log("{message}");',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    variables: [
      { name: 'message', placeholder: 'Log message', required: true, type: 'text' }
    ],
    tags: ['code', 'javascript', 'debug']
  },
  {
    id: 'address',
    trigger: ';addr',
    content: `{name}
{street}
{city}, {state} {zip}
{country}`,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    variables: [
      { name: 'name', placeholder: 'Full name', required: true, type: 'text' },
      { name: 'street', placeholder: 'Street address', required: true, type: 'text' },
      { name: 'city', placeholder: 'City', required: true, type: 'text' },
      { name: 'state', placeholder: 'State/Province', required: true, type: 'text' },
      { name: 'zip', placeholder: 'ZIP/Postal code', required: true, type: 'text' },
      { name: 'country', placeholder: 'Country', required: false, type: 'text' }
    ],
    tags: ['personal', 'address', 'contact']
  },
  {
    id: 'date-today',
    trigger: ';today',
    content: new Date().toLocaleDateString(),
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    variables: [],
    tags: ['date', 'utility']
  },
  {
    id: 'email-template',
    trigger: ';email',
    content: `Subject: {subject}

Hi {recipient},

{body}

Best regards,
{sender}`,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    variables: [
      { name: 'subject', placeholder: 'Email subject', required: true, type: 'text' },
      { name: 'recipient', placeholder: 'Recipient name', required: true, type: 'text' },
      { name: 'body', placeholder: 'Email body', required: true, type: 'textarea' },
      { name: 'sender', placeholder: 'Your name', required: true, type: 'text' }
    ],
    tags: ['email', 'template', 'communication']
  }
];

// Default test settings
const TEST_SETTINGS = {
  enabled: true,
  cloudProvider: 'local',
  autoSync: false, // Disable sync for testing
  syncInterval: 30,
  showNotifications: true,
  triggerDelay: 100,
  caseSensitive: false,
  enableSharedSnippets: true,
  triggerPrefix: ';',
  excludePasswords: true
};

/**
 * Setup test data in Chrome storage
 */
async function setupTestData() {
  try {
    console.log('🚀 Setting up test data for Collaborative Text Expander...');
    
    // Set test snippets
    await chrome.storage.local.set({
      'snippets': SAMPLE_SNIPPETS
    });
    console.log(`✅ Added ${SAMPLE_SNIPPETS.length} test snippets`);
    
    // Set test settings
    await chrome.storage.sync.set({
      'settings': TEST_SETTINGS
    });
    console.log('✅ Applied test settings');
    
    // Set initial sync status
    await chrome.storage.local.set({
      'syncStatus': {
        lastSync: new Date().toISOString(),
        status: 'idle',
        error: null,
        snippetCount: SAMPLE_SNIPPETS.length
      }
    });
    console.log('✅ Set initial sync status');
    
    console.log('\n🎉 Test data setup complete!');
    console.log('\n📝 Available test triggers:');
    SAMPLE_SNIPPETS.forEach(snippet => {
      const vars = snippet.variables.length > 0 ? ` (${snippet.variables.length} variables)` : '';
      console.log(`  ${snippet.trigger} - ${snippet.content.split('\n')[0].substring(0, 50)}...${vars}`);
    });
    
    console.log('\n🧪 To test:');
    console.log('1. Navigate to any text input field');
    console.log('2. Type a trigger (e.g., ";hello") followed by Tab or Space');
    console.log('3. Watch the magic happen!');
    
  } catch (error) {
    console.error('❌ Failed to setup test data:', error);
  }
}

/**
 * Clear all test data
 */
async function clearTestData() {
  try {
    console.log('🧹 Clearing test data...');
    await chrome.storage.local.clear();
    await chrome.storage.sync.clear();
    console.log('✅ Test data cleared');
  } catch (error) {
    console.error('❌ Failed to clear test data:', error);
  }
}

/**
 * Show current storage contents
 */
async function showStorageContents() {
  try {
    const local = await chrome.storage.local.get();
    const sync = await chrome.storage.sync.get();
    
    console.log('📦 Local Storage:', local);
    console.log('☁️  Sync Storage:', sync);
    
    if (local.snippets) {
      console.log(`\n📝 ${local.snippets.length} snippets found:`);
      local.snippets.forEach(snippet => {
        console.log(`  ${snippet.trigger}: ${snippet.content.substring(0, 50)}...`);
      });
    }
  } catch (error) {
    console.error('❌ Failed to read storage:', error);
  }
}

// Export functions for console use
window.setupTestData = setupTestData;
window.clearTestData = clearTestData;
window.showStorageContents = showStorageContents;

// Auto-run if this script is executed directly
if (typeof chrome !== 'undefined' && chrome.storage) {
  console.log('🔧 Test data setup script loaded. Run setupTestData() to begin.');
} else {
  console.log('⚠️  Chrome extension APIs not available. Load this script in extension context.');
}