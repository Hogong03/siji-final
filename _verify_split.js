const fs = require('fs');
const s = fs.readFileSync('C:/Users/c3798/Desktop/思迹/pages/chat/index.vue', 'utf8');
const c = fs.readFileSync('C:/Users/c3798/Desktop/思迹/components/chat/ConversationPanel.vue', 'utf8');

const checks = [
  ['Import ConversationPanel', s.includes('import ConversationPanel')],
  ['No formatConvTime in index', !/function formatConvTime/.test(s)],
  ['ConversationPanel tag present', s.includes('<ConversationPanel')],
  [':show prop', s.includes(':show="showConvList"')],
  [':conversations prop', s.includes(':conversations="sortedConversations"')],
  [':active-id prop', s.includes(':active-id="store.activeConversationId"')],
  ['@close event', s.includes('@close="toggleConvList"')],
  ['@switch event', s.includes('@switch="handleSwitchConversation"')],
  ['@delete event', s.includes('@delete="handleDeleteConversation"')],
  ['@rename event', s.includes('@rename="handleRenameConversation"')],
  ['@new event', s.includes('@new="handleNewConversation"')],
  ['No conv-mask CSS in index', !/\.conv-mask\s*\{/.test(s)],
  ['No conv-drawer CSS in index', !/\.conv-drawer\s*\{/.test(s)],
  ['No conv-item CSS in index', !/\.conv-item\s*\{/.test(s)],
  ['Component has formatConvTime', c.includes('function formatConvTime')],
  ['Component has conv-mask CSS', c.includes('.conv-mask')],
  ['Component has scoped style', c.includes('scoped')],
  ['toggleConvList still in index', s.includes('function toggleConvList')],
  ['sortedConversations still in index', s.includes('const sortedConversations')],
  ['handleSwitchConversation still in index', s.includes('function handleSwitchConversation')],
  ['handleDeleteConversation still in index', s.includes('function handleDeleteConversation')],
  ['handleRenameConversation still in index', s.includes('function handleRenameConversation')],
  ['handleNewConversation still in index', s.includes('function handleNewConversation')],
];

let pass = 0, fail = 0;
checks.forEach(([name, ok]) => {
  if (ok) { console.log('OK  ' + name); pass++; }
  else    { console.log('FAIL ' + name); fail++; }
});
console.log('\nPass: ' + pass + '/' + checks.length + '  Fail: ' + fail);
if (fail > 0) process.exit(1);
