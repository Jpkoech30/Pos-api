import express from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Mock data — replace with DB queries later
const MOCK_ACCOUNTS = [
  {
    id: 'acc_checking',
    type: 'checking',
    name: 'Everyday Checking',
    accountNumber: '•••• 4821',
    balance: 3245.87,
    currency: 'USD',
  },
  {
    id: 'acc_savings',
    type: 'savings',
    name: 'High-Yield Savings',
    accountNumber: '•••• 9067',
    balance: 12840.42,
    currency: 'USD',
  },
  {
    id: 'acc_credit',
    type: 'credit',
    name: 'Rewards Credit Card',
    accountNumber: '•••• 3310',
    balance: -842.15,
    currency: 'USD',
  },
];

const MOCK_TRANSACTIONS = [
  { id: 't1', accountId: 'acc_checking', merchant: 'Starbucks', amount: -6.75, date: '2026-09-27' },
  { id: 't2', accountId: 'acc_checking', merchant: 'Payroll Deposit', amount: 2400.0, date: '2026-09-26' },
  { id: 't3', accountId: 'acc_checking', merchant: 'Whole Foods', amount: -127.43, date: '2026-09-25' },
  { id: 't4', accountId: 'acc_savings', merchant: 'Interest', amount: 12.84, date: '2026-09-24' },
];

// GET /accounts — protected
router.get('/', requireAuth, (req, res) => {
  res.json({
    accounts: MOCK_ACCOUNTS,
    totalBalance: MOCK_ACCOUNTS.reduce((sum, a) => sum + a.balance, 0),
  });
});

// GET /accounts/:id/transactions — protected
router.get('/:id/transactions', requireAuth, (req, res) => {
  const transactions = MOCK_TRANSACTIONS.filter((t) => t.accountId === req.params.id);
  res.json({ transactions });
});

export default router;