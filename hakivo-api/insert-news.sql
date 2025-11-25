
> hakivo-api@1.0.0 populate-news
> ts-node scripts/populate-news.ts

🚀 Starting news population script...

📅 Fetching news from 2025-11-18T19:10:45.754Z to 2025-11-25T19:10:45.754Z
📰 Articles per interest: 25

🔍 Syncing: Environment & Energy
   Keywords: climate, pollution, renewables...
(node:17394) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/tarikmoody/Documents/Projects/hakivo-v2/hakivo-api/scripts/populate-news.ts is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/tarikmoody/Documents/Projects/hakivo-v2/hakivo-api/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
   Found 0 articles
🔍 Syncing: Health & Social Welfare
   Keywords: healthcare, insurance, public health...
   Found 0 articles
🔍 Syncing: Economy & Finance
   Keywords: budget, inflation, taxes...
   Found 0 articles
🔍 Syncing: Education & Science
   Keywords: schools, universities, academic...
   Found 1 articles
   🔄 Recategorized: "Crypto has some regulatory asks for Trump..."
      Education & Science → Government & Politics
🔍 Syncing: Civil Rights & Law
   Keywords: equality, justice, discrimination...
   Found 0 articles
🔍 Syncing: Commerce & Labor
   Keywords: business, jobs, workforce...
   Found 0 articles
🔍 Syncing: Government & Politics
   Keywords: elections, governance, legislation...
   Found 1 articles
🔍 Syncing: Foreign Policy & Defense
   Keywords: military, defense, trade agreements...
   Found 0 articles
🔍 Syncing: Housing & Urban Development
   Keywords: housing, urban planning, infrastructure...
   Found 0 articles
🔍 Syncing: Agriculture & Food
   Keywords: farming, food security, rural...
   Found 0 articles
🔍 Syncing: Sports, Arts & Culture
   Keywords: sports, arts, culture...
   Found 0 articles
🔍 Syncing: Immigration & Indigenous Issues
   Keywords: immigration, border, citizenship...
   Found 0 articles

✅ News fetch completed
   Total articles fetched: 2
   Successful syncs: 12/12
   Failed syncs: 0
   Duration: 18.57s

📝 Generating SQL INSERT statements...

-- Copy and paste these into Raindrop SQL admin or run via Wrangler D1
-- Database: app-db

INSERT INTO news_articles (
  id, interest, title, url, author, summary, text,
  image_url, published_date, fetched_at, score, source_domain
) VALUES (
  '79c4eccd-1914-4f74-b1f1-d62eed8e3a17',
  'Government & Politics',
  'Crypto has some regulatory asks for Trump',
  'https://punchbowl.news/article/vault/crypto-letter-trump/',
  NULL,
  'A coalition of crypto companies is urging President Trump to take immediate regulatory actions to support the industry, focusing on issues like tax and regulatory clarity. They believe that these steps can provide quick benefits alongside ongoing legislative efforts.',
  '[Skip to content](https://punchbowl.news/punchbowl.news#start-of-content)

Premium

November 20, 2025

# Crypto has some regulatory asks for Trump

**First****in The Vault:**A large coalition of crypto companies and trade associations is urging President **Donald Trump** to take “immediate” regulatory steps to support the industry.

**A letter released Thursday** and addressed to Trump lays out several priorities in “tax clarity,” “regulatory clarity” and decentralized finance the group would like to see implemented. It was led by the Solana Policy Institute and joined by groups like the Blockchain Association, Crypto Council for Innovation, Uniswap Foundation, the Digital Chamber, DeFi Education Fund and Paradigm.

**Separate from Capitol Hill,** the groups said, “there are other steps that can be taken by the Administration that deliver quick wins to complement legislative efforts.”

#### You''re seeing a preview of our Premium coverage. Read the full story by [subscribing here.](https://punchbowl.news/pricing)

Already a subscriber? [Log In](https://punchbowlnews.memberful.com/auth/sign_in?_ga=2.142112180.709615288.1695618073-919362650.1695618073&return_to=https://punchbowl.news/article/vault/crypto-letter-trump/)

[Finance + Economy](https://punchbowl.news/policy/finance-economy) [The Vault](https://punchbowl.news/vault) [White House](https://punchbowl.news/washington/white-house)

Related

[**Crypto gets a good(ish) Senate headline** \
The Senate Agriculture Committee made a splash on Monday night, releasing a draft of crypto market structure legislation with bipartisan backing.\
\
The VaultThe Vault](https://punchbowl.news/article/vault/crypto-senate-headline/) [**Senate Ag moves on crypto, plus credit card wars** \
The VaultFinance + Economy](https://punchbowl.news/article/finance/economy/senate-agriculture-committee-crypto-credit-card-wars/) [**Market structure enters the ‘please don’t ask us’ phase** \
The VaultThe Vault](https://punchbowl.news/article/vault/market-structure-dont-ask-phase/)

Editorial photos provided by Getty Images. Political ads courtesy of AdImpact.

Close Popup

## Unlock access for more

Sign up to receive our free morning edition every weekday, and you''ll never miss a scoop.

Email
Address

Did you mean ?

Oops! Something went wrong. Please refresh and try again.

Subscribe

Did you mean ?

Oops! Something went wrong. Please refresh and try again.

Error: You have to enable cookies to submit this form.

Thank you for signing up!

[Already subscribed? Sign in.](https://punchbowlnews.memberful.com/auth/sign_in)',
  'https://punchbowl.news/wp-content/uploads/DonaldTrump_01232025-2-1.jpg',
  '2025-11-20T19:10:50.840Z',
  1764097864325,
  0,
  'punchbowl.news'
);
INSERT INTO news_articles (
  id, interest, title, url, author, summary, text,
  image_url, published_date, fetched_at, score, source_domain
) VALUES (
  '99f6df45-1342-4595-990b-26ea7588b389',
  'Government & Politics',
  'Crypto has some regulatory asks for Trump',
  'https://punchbowl.news/article/vault/crypto-letter-trump/',
  NULL,
  'A coalition of crypto companies is urging President Trump to take immediate regulatory actions to support the industry, focusing on issues like tax and regulatory clarity. They believe that quick administrative steps can complement ongoing legislative efforts to enhance the crypto landscape.',
  '[Skip to content](https://punchbowl.news/punchbowl.news#start-of-content)

Premium

November 20, 2025

# Crypto has some regulatory asks for Trump

**First****in The Vault:**A large coalition of crypto companies and trade associations is urging President **Donald Trump** to take “immediate” regulatory steps to support the industry.

**A letter released Thursday** and addressed to Trump lays out several priorities in “tax clarity,” “regulatory clarity” and decentralized finance the group would like to see implemented. It was led by the Solana Policy Institute and joined by groups like the Blockchain Association, Crypto Council for Innovation, Uniswap Foundation, the Digital Chamber, DeFi Education Fund and Paradigm.

**Separate from Capitol Hill,** the groups said, “there are other steps that can be taken by the Administration that deliver quick wins to complement legislative efforts.”

#### You''re seeing a preview of our Premium coverage. Read the full story by [subscribing here.](https://punchbowl.news/pricing)

Already a subscriber? [Log In](https://punchbowlnews.memberful.com/auth/sign_in?_ga=2.142112180.709615288.1695618073-919362650.1695618073&return_to=https://punchbowl.news/article/vault/crypto-letter-trump/)

[Finance + Economy](https://punchbowl.news/policy/finance-economy) [The Vault](https://punchbowl.news/vault) [White House](https://punchbowl.news/washington/white-house)

Related

[**Crypto gets a good(ish) Senate headline** \
The Senate Agriculture Committee made a splash on Monday night, releasing a draft of crypto market structure legislation with bipartisan backing.\
\
The VaultThe Vault](https://punchbowl.news/article/vault/crypto-senate-headline/) [**Senate Ag moves on crypto, plus credit card wars** \
The VaultFinance + Economy](https://punchbowl.news/article/finance/economy/senate-agriculture-committee-crypto-credit-card-wars/) [**Market structure enters the ‘please don’t ask us’ phase** \
The VaultThe Vault](https://punchbowl.news/article/vault/market-structure-dont-ask-phase/)

Editorial photos provided by Getty Images. Political ads courtesy of AdImpact.

Close Popup

## Unlock access for more

Sign up to receive our free morning edition every weekday, and you''ll never miss a scoop.

Email
Address

Did you mean ?

Oops! Something went wrong. Please refresh and try again.

Subscribe

Did you mean ?

Oops! Something went wrong. Please refresh and try again.

Error: You have to enable cookies to submit this form.

Thank you for signing up!

[Already subscribed? Sign in.](https://punchbowlnews.memberful.com/auth/sign_in)',
  'https://punchbowl.news/wp-content/uploads/DonaldTrump_01232025-2-1.jpg',
  '2025-11-20T19:10:56.660Z',
  1764097864325,
  0,
  'punchbowl.news'
);

✨ Done! Copy the SQL statements above and run them in Raindrop SQL admin.
   Or save to a file and use: wrangler d1 execute app-db --file=insert-news.sql
