import type { Topic } from './types'

// ⚠️ PLACEHOLDER CONTENT — authored by the build session, not by Julius.
// The seed_content.json bank has no `t_account` items yet, but the T-account
// posting interaction is a core question type (Build Spec §3, type 4). These
// two items let that interaction run end-to-end now. Replace this whole file
// (or delete it and add real t_account items to seed_content.json) when the
// authored Stage-2 T-account content arrives — the loader merges it in.

export const PLACEHOLDER_TACCOUNT: Topic = {
  id: 't5-taccount',
  order: 5,
  title: { en: 'T-Accounts', ms: 'Akaun T' },
  lessons: [
    {
      id: 'l6-post-balance',
      order: 1,
      title: { en: 'Post & Balance', ms: 'Catat & Baki' },
      worked_example: {
        prompt: {
          en: 'A T-account has debits on the left, credits on the right. The closing balance is the difference, on the side with the larger total.',
          ms: 'Akaun T ada debit di kiri, kredit di kanan. Baki penutup ialah bezanya, di sebelah yang jumlahnya lebih besar.',
        },
      },
      items: [
        {
          id: 'ta-001',
          type: 't_account',
          difficulty: 2,
          skill_tags: ['t-account', 'debit-credit'],
          prompt: {
            en: 'Post these to the Cash account, then find the closing balance.',
            ms: 'Catat ini ke akaun Tunai, kemudian cari baki penutup.',
          },
          data: {
            account: 'Cash',
            account_ms: 'Tunai',
            entries: [
              {
                label: { en: 'Capital introduced', ms: 'Modal dimasukkan' },
                amount: 20000,
                side: 'debit',
              },
              {
                label: { en: 'Bought a van', ms: 'Beli van' },
                amount: 12000,
                side: 'credit',
              },
              {
                label: { en: 'Cash sales', ms: 'Jualan tunai' },
                amount: 1500,
                side: 'debit',
              },
            ],
          },
          answer: { balance: 9500, side: 'debit' },
          explanation: {
            en: 'Debits 20,000 + 1,500 = 21,500. Credits 12,000. Balance 9,500 on the debit side (cash on hand).',
            ms: 'Debit 20,000 + 1,500 = 21,500. Kredit 12,000. Baki 9,500 di sebelah debit (tunai di tangan).',
          },
        },
        {
          id: 'ta-002',
          type: 't_account',
          difficulty: 3,
          skill_tags: ['t-account', 'debit-credit'],
          prompt: {
            en: 'Post these to the Trade Payables account, then find the closing balance.',
            ms: 'Catat ini ke akaun Pemiutang Perdagangan, kemudian cari baki penutup.',
          },
          data: {
            account: 'Trade Payables',
            account_ms: 'Pemiutang Perdagangan',
            entries: [
              {
                label: { en: 'Bought inventory on credit', ms: 'Beli inventori secara kredit' },
                amount: 3000,
                side: 'credit',
              },
              {
                label: { en: 'Paid supplier', ms: 'Bayar pembekal' },
                amount: 1800,
                side: 'debit',
              },
            ],
          },
          answer: { balance: 1200, side: 'credit' },
          explanation: {
            en: 'Credits 3,000, debits 1,800. Balance 1,200 on the credit side — still owed to the supplier.',
            ms: 'Kredit 3,000, debit 1,800. Baki 1,200 di sebelah kredit — masih terhutang kepada pembekal.',
          },
        },
      ],
    },
  ],
}
