#!/bin/bash
# Send articles to production database via admin API

curl -X POST https://svc-01kc6rbecv0s5k4yk6ksdaqyz19.01k66gywmx8x4r0w31fdjjfekf.lmapp.run/admin/insert-articles \
  -H "Content-Type: application/json" \
  -d '{
    "articles": [
      {
        "id": "79c4eccd-1914-4f74-b1f1-d62eed8e3a17",
        "interest": "Government & Politics",
        "title": "Crypto has some regulatory asks for Trump",
        "url": "https://punchbowl.news/article/vault/crypto-letter-trump/",
        "author": null,
        "summary": "A coalition of crypto companies is urging President Trump to take immediate regulatory actions to support the industry, focusing on issues like tax and regulatory clarity. They believe that these steps can provide quick benefits alongside ongoing legislative efforts.",
        "text": "[Skip to content](https://punchbowl.news/punchbowl.news#start-of-content)\n\nPremium\n\nNovember 20, 2025\n\n# Crypto has some regulatory asks for Trump\n\n**First****in The Vault:**A large coalition of crypto companies and trade associations is urging President **Donald Trump** to take \"immediate\" regulatory steps to support the industry.\n\n**A letter released Thursday** and addressed to Trump lays out several priorities in \"tax clarity,\" \"regulatory clarity\" and decentralized finance the group would like to see implemented. It was led by the Solana Policy Institute and joined by groups like the Blockchain Association, Crypto Council for Innovation, Uniswap Foundation, the Digital Chamber, DeFi Education Fund and Paradigm.\n\n**Separate from Capitol Hill,** the groups said, \"there are other steps that can be taken by the Administration that deliver quick wins to complement legislative efforts.\"",
        "image_url": "https://punchbowl.news/wp-content/uploads/DonaldTrump_01232025-2-1.jpg",
        "published_date": "2025-11-20T19:10:50.840Z",
        "fetched_at": 1764097864325,
        "score": 0,
        "source_domain": "punchbowl.news"
      },
      {
        "id": "99f6df45-1342-4595-990b-26ea7588b389",
        "interest": "Government & Politics",
        "title": "Crypto has some regulatory asks for Trump",
        "url": "https://punchbowl.news/article/vault/crypto-letter-trump/",
        "author": null,
        "summary": "A coalition of crypto companies is urging President Trump to take immediate regulatory actions to support the industry, focusing on issues like tax and regulatory clarity. They believe that quick administrative steps can complement ongoing legislative efforts to enhance the crypto landscape.",
        "text": "[Skip to content](https://punchbowl.news/punchbowl.news#start-of-content)\n\nPremium\n\nNovember 20, 2025\n\n# Crypto has some regulatory asks for Trump\n\n**First****in The Vault:**A large coalition of crypto companies and trade associations is urging President **Donald Trump** to take \"immediate\" regulatory steps to support the industry.\n\n**A letter released Thursday** and addressed to Trump lays out several priorities in \"tax clarity,\" \"regulatory clarity\" and decentralized finance the group would like to see implemented. It was led by the Solana Policy Institute and joined by groups like the Blockchain Association, Crypto Council for Innovation, Uniswap Foundation, the Digital Chamber, DeFi Education Fund and Paradigm.\n\n**Separate from Capitol Hill,** the groups said, \"there are other steps that can be taken by the Administration that deliver quick wins to complement legislative efforts.\"",
        "image_url": "https://punchbowl.news/wp-content/uploads/DonaldTrump_01232025-2-1.jpg",
        "published_date": "2025-11-20T19:10:56.660Z",
        "fetched_at": 1764097864325,
        "score": 0,
        "source_domain": "punchbowl.news"
      }
    ]
  }'
