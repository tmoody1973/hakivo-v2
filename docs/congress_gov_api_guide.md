# A Comprehensive Guide to the Congress.gov API

## Introduction

The Congress.gov API provides public access to a wealth of legislative data from the United States Congress. This guide offers a comprehensive overview of the API, its endpoints, and how to effectively use it to retrieve data for your applications. The examples provided are tailored for use with Claude Code, ensuring clarity and ease of implementation.

This guide is based on the official Congress.gov API documentation available on their GitHub repository [1].

## Getting Started: Your API Key

To use the Congress.gov API, you must first obtain an API key. This key is used to authenticate your requests and track your usage.

1.  **Sign up for an API Key**: Navigate to the [api.data.gov signup page](https://api.data.gov/signup/) to register for a free API key.
2.  **Receive Your Key**: After filling out the form, you will receive your API key via email. Keep this key secure, as it is your unique identifier for accessing the API.

## Authentication

All requests to the Congress.gov API must include your API key. The key can be passed as a query parameter in the URL.

**Example:**

```
https://api.congress.gov/v3/bill?api_key=YOUR_API_KEY
```

For the examples in this guide, we will use `DEMO_KEY`. Remember to replace this with your actual API key when implementing your code.

## Rate Limiting

The Congress.gov API has a rate limit of **5,000 requests per hour** per API key. If you exceed this limit, you will receive a `429 Too Many Requests` error. It is important to manage your requests to stay within this limit. If you are making a large number of requests, consider adding a delay between them.

## Pagination

By default, the API returns 20 results per request. You can adjust this using the `limit` parameter, up to a maximum of 250 results. To navigate through the full set of results, you can use the `offset` parameter to specify the starting record.

*   `limit`: The number of results to return (max 250).
*   `offset`: The starting record for the results.

The response from the API includes a `pagination` object that contains URLs for the `next` and `previous` pages of results, making it easy to iterate through large datasets.

## API Endpoints

This section provides a detailed overview of each available endpoint in the Congress.gov API. For each endpoint, you will find a description, the URL structure, available parameters, a Python code example, and a sample JSON response.

### 1. Bill Endpoint

The Bill endpoint is one of the most comprehensive endpoints in the Congress.gov API. It allows you to retrieve information about legislation, including details, actions, amendments, and more.

**Base URL**: `/bill`

#### 1.1. List All Bills

This endpoint returns a list of all bills, sorted by the date of the latest action.

*   **URL**: `https://api.congress.gov/v3/bill`

**Python Example (Claude Code):**

```python
import requests

API_KEY = "DEMO_KEY"
BASE_URL = "https://api.congress.gov/v3"

response = requests.get(f"{BASE_URL}/bill", params={"api_key": API_KEY, "format": "json"})
data = response.json()

print(data)
```

#### 1.2. List Bills by Congress

Filter bills by a specific Congress.

*   **URL**: `https://api.congress.gov/v3/bill/{congress}`
*   **Parameter**: `{congress}` (e.g., 118)

**Python Example (Claude Code):**

```python
import requests

API_KEY = "DEMO_KEY"
BASE_URL = "https://api.congress.gov/v3"
CONGRESS = 118

response = requests.get(f"{BASE_URL}/bill/{CONGRESS}", params={"api_key": API_KEY, "format": "json"})
data = response.json()

print(data)
```

#### 1.3. List Bills by Congress and Bill Type

Filter bills by Congress and type (e.g., HR for House Bill, S for Senate Bill).

*   **URL**: `https://api.congress.gov/v3/bill/{congress}/{billType}`
*   **Parameters**:
    *   `{congress}` (e.g., 118)
    *   `{billType}` (e.g., hr)

**Python Example (Claude Code):**

```python
import requests

API_KEY = "DEMO_KEY"
BASE_URL = "https://api.congress.gov/v3"
CONGRESS = 118
BILL_TYPE = "hr"

response = requests.get(f"{BASE_URL}/bill/{CONGRESS}/{BILL_TYPE}", params={"api_key": API_KEY, "format": "json"})
data = response.json()

print(data)
```

#### 1.4. Get a Specific Bill

Retrieve detailed information for a specific bill.

*   **URL**: `https://api.congress.gov/v3/bill/{congress}/{billType}/{billNumber}`
*   **Parameters**:
    *   `{congress}` (e.g., 118)
    *   `{billType}` (e.g., hr)
    *   `{billNumber}` (e.g., 1)

**Python Example (Claude Code):**

```python
import requests

API_KEY = "DEMO_KEY"
BASE_URL = "https://api.congress.gov/v3"
CONGRESS = 118
BILL_TYPE = "hr"
BILL_NUMBER = 1

response = requests.get(f"{BASE_URL}/bill/{CONGRESS}/{BILL_TYPE}/{BILL_NUMBER}", params={"api_key": API_KEY, "format": "json"})
data = response.json()

print(data)
```

**Sample JSON Response (Partial):**

```json
{
  "bill": {
    "congress": 118,
    "title": "For the People Act of 2023",
    "number": "1",
    "originChamber": "House",
    "type": "HR",
    "latestAction": {
      "actionDate": "2023-03-01",
      "text": "Referred to the Committee on House Administration, and in addition to the Committees on Intelligence (Permanent Select), Judiciary, Oversight and Accountability, Science, Space, and Technology, Education and the Workforce, Ways and Means, and Financial Services, for a period to be subsequently determined by the Speaker, in each case for consideration of such provisions as fall within the jurisdiction of the committee concerned."
    }
  }
}
```

#### 1.5. Bill Sub-endpoints

The Bill endpoint has several sub-endpoints to retrieve specific information related to a bill. These sub-endpoints are appended to the specific bill URL.

*   `/actions`: List of actions taken on the bill.
*   `/amendments`: List of amendments to the bill.
*   `/committees`: List of committees associated with the bill.
*   `/cosponsors`: List of cosponsors of the bill.
*   `/relatedbills`: List of related bills.
*   `/subjects`: List of legislative subjects related to the bill.
*   `/summaries`: Summaries of the bill.
*   `/text`: Text versions of the bill.
*   `/titles`: Official and popular titles of the bill.

**Example URL for `/actions`:**
`https://api.congress.gov/v3/bill/118/hr/1/actions`

### 2. Amendment Endpoint

The Amendment endpoint provides information about amendments to legislation.

**Base URL**: `/amendment`

#### 2.1. List All Amendments

This endpoint returns a list of all amendments, sorted by the date of the latest action.

*   **URL**: `https://api.congress.gov/v3/amendment`

**Python Example (Claude Code):**

```python
import requests

API_KEY = "DEMO_KEY"
BASE_URL = "https://api.congress.gov/v3"

response = requests.get(f"{BASE_URL}/amendment", params={"api_key": API_KEY, "format": "json"})
data = response.json()

print(data)
```

#### 2.2. List Amendments by Congress

Filter amendments by a specific Congress.

*   **URL**: `https://api.congress.gov/v3/amendment/{congress}`
*   **Parameter**: `{congress}` (e.g., 118)

**Python Example (Claude Code):**

```python
import requests

API_KEY = "DEMO_KEY"
BASE_URL = "https://api.congress.gov/v3"
CONGRESS = 118

response = requests.get(f"{BASE_URL}/amendment/{CONGRESS}", params={"api_key": API_KEY, "format": "json"})
data = response.json()

print(data)
```

#### 2.3. Get a Specific Amendment

Retrieve detailed information for a specific amendment.

*   **URL**: `https://api.congress.gov/v3/amendment/{congress}/{amendmentType}/{amendmentNumber}`
*   **Parameters**:
    *   `{congress}` (e.g., 117)
    *   `{amendmentType}` (e.g., samdt)
    *   `{amendmentNumber}` (e.g., 2137)

**Python Example (Claude Code):**

```python
import requests

API_KEY = "DEMO_KEY"
BASE_URL = "https://api.congress.gov/v3"
CONGRESS = 117
AMENDMENT_TYPE = "samdt"
AMENDMENT_NUMBER = 2137

response = requests.get(f"{BASE_URL}/amendment/{CONGRESS}/{AMENDMENT_TYPE}/{AMENDMENT_NUMBER}", params={"api_key": API_KEY, "format": "json"})
data = response.json()

print(data)
```

**Sample JSON Response (Partial):**

```json
{
  "amendment": {
    "congress": 117,
    "number": "2137",
    "type": "SAMDT",
    "purpose": "In the nature of a substitute.",
    "latestAction": {
      "actionDate": "2021-08-08",
      "text": "Amendment SA 2137 agreed to in Senate by Yea-Nay Vote. 69 - 28. Record Vote Number: 312."
    }
  }
}
```

### 3. Summaries Endpoint

The Summaries endpoint provides access to bill summaries created by the Congressional Research Service (CRS).

**Base URL**: `/summaries`

#### 3.1. List All Summaries

This endpoint returns a list of all bill summaries, sorted by the date of the last update.

*   **URL**: `https://api.congress.gov/v3/summaries`

**Python Example (Claude Code):**

```python
import requests

API_KEY = "DEMO_KEY"
BASE_URL = "https://api.congress.gov/v3"

response = requests.get(f"{BASE_URL}/summaries", params={"api_key": API_KEY, "format": "json"})
data = response.json()

print(data)
```

#### 3.2. List Summaries by Congress

Filter summaries by a specific Congress.

*   **URL**: `https://api.congress.gov/v3/summaries/{congress}`
*   **Parameter**: `{congress}` (e.g., 118)

**Python Example (Claude Code):**

```python
import requests

API_KEY = "DEMO_KEY"
BASE_URL = "https://api.congress.gov/v3"
CONGRESS = 118

response = requests.get(f"{BASE_URL}/summaries/{CONGRESS}", params={"api_key": API_KEY, "format": "json"})
data = response.json()

print(data)
```

**Sample JSON Response (Partial):**

```json
{
  "summaries": [
    {
      "bill": {
        "congress": 118,
        "number": "8432",
        "title": "Beagle Brigade Act of 2022",
        "type": "HR"
      },
      "text": "<p><strong>Beagle Brigade Act of 2022</strong></p> <p>This bill provides statutory authority for the National Detector Dog Training Center...",
      "actionDate": "2022-05-16",
      "actionDesc": "Introduced in House",
      "updateDate": "2022-08-18T17:00:44Z"
    }
  ]
}
```

### 4. Congress Endpoint

The Congress endpoint provides information about each Congress, including session dates.

**Base URL**: `/congress`

#### 4.1. List All Congresses

This endpoint returns a list of all Congresses and their sessions.

*   **URL**: `https://api.congress.gov/v3/congress`

**Python Example (Claude Code):**

```python
import requests

API_KEY = "DEMO_KEY"
BASE_URL = "https://api.congress.gov/v3"

response = requests.get(f"{BASE_URL}/congress", params={"api_key": API_KEY, "format": "json"})
data = response.json()

print(data)
```

#### 4.2. Get a Specific Congress

Retrieve detailed information for a specific Congress.

*   **URL**: `https://api.congress.gov/v3/congress/{congress}`
*   **Parameter**: `{congress}` (e.g., 118)

**Python Example (Claude Code):**

```python
import requests

API_KEY = "DEMO_KEY"
BASE_URL = "https://api.congress.gov/v3"
CONGRESS = 118

response = requests.get(f"{BASE_URL}/congress/{CONGRESS}", params={"api_key": API_KEY, "format": "json"})
data = response.json()

print(data)
```

**Sample JSON Response (Partial):**

```json
{
  "congress": {
    "endYear": "2024",
    "name": "118th Congress",
    "number": 118,
    "sessions": [
      {
        "chamber": "House of Representatives",
        "endDate": "2024-01-03",
        "number": 2,
        "startDate": "2024-01-03",
        "type": "R"
      },
      {
        "chamber": "Senate",
        "endDate": "2024-01-03",
        "number": 2,
        "startDate": "2024-01-03",
        "type": "R"
      }
    ],
    "startYear": "2023"
  }
}
```

### 5. Member Endpoint

The Member endpoint provides detailed information about members of Congress, including their biographical data, terms of service, and sponsored legislation.

**Base URL**: `/member`

#### 5.1. List All Members

This endpoint returns a list of all members of Congress.

*   **URL**: `https://api.congress.gov/v3/member`

**Python Example (Claude Code):**

```python
import requests

API_KEY = "DEMO_KEY"
BASE_URL = "https://api.congress.gov/v3"

response = requests.get(f"{BASE_URL}/member", params={"api_key": API_KEY, "format": "json"})
data = response.json()

print(data)
```

#### 5.2. Get a Specific Member

Retrieve detailed information for a specific member using their `bioguideId`.

*   **URL**: `https://api.congress.gov/v3/member/{bioguideId}`
*   **Parameter**: `{bioguideId}` (e.g., L000174)

**Python Example (Claude Code):**

```python
import requests

API_KEY = "DEMO_KEY"
BASE_URL = "https://api.congress.gov/v3"
BIOGUIDE_ID = "L000174"

response = requests.get(f"{BASE_URL}/member/{BIOGUIDE_ID}", params={"api_key": API_KEY, "format": "json"})
data = response.json()

print(data)
```

**Sample JSON Response (Partial):**

```json
{
  "member": {
    "bioguideId": "L000174",
    "birthYear": "1940",
    "firstName": "Patrick",
    "lastName": "Leahy",
    "party": "Democrat",
    "state": "Vermont",
    "terms": {
        "item": [
            {
                "chamber": "Senate",
                "congress": "94",
                "startYear": 1975
            }
        ]
    }
  }
}
```

#### 5.3. Get Sponsored Legislation

Retrieve the list of legislation sponsored by a specific member.

*   **URL**: `https://api.congress.gov/v3/member/{bioguideId}/sponsored-legislation`
*   **Parameter**: `{bioguideId}` (e.g., L000174)

**Python Example (Claude Code):**

```python
import requests

API_KEY = "DEMO_KEY"
BASE_URL = "https://api.congress.gov/v3"
BIOGUIDE_ID = "L000174"

response = requests.get(f"{BASE_URL}/member/{BIOGUIDE_ID}/sponsored-legislation", params={"api_key": API_KEY, "format": "json"})
data = response.json()

print(data)
```

#### 5.4. Get Cosponsored Legislation

Retrieve the list of legislation cosponsored by a specific member.

*   **URL**: `https://api.congress.gov/v3/member/{bioguideId}/cosponsored-legislation`
*   **Parameter**: `{bioguideId}` (e.g., L000174)

**Python Example (Claude Code):**

```python
import requests

API_KEY = "DEMO_KEY"
BASE_URL = "https://api.congress.gov/v3"
BIOGUIDE_ID = "L000174"

response = requests.get(f"{BASE_URL}/member/{BIOGUIDE_ID}/cosponsored-legislation", params={"api_key": API_KEY, "format": "json"})
data = response.json()

print(data)
```

#### 5.5. List Members by Congress

Retrieve the list of members for a specific Congress.

*   **URL**: `https://api.congress.gov/v3/member/congress/{congress}`
*   **Parameter**: `{congress}` (e.g., 118)

**Python Example (Claude Code):**

```python
import requests

API_KEY = "DEMO_KEY"
BASE_URL = "https://api.congress.gov/v3"
CONGRESS = 118

response = requests.get(f"{BASE_URL}/member/congress/{CONGRESS}", params={"api_key": API_KEY, "format": "json", "currentMember": "false"})
data = response.json()

print(data)
```

#### 5.6. List Members by State

Retrieve a list of members filtered by state.

*   **URL**: `https://api.congress.gov/v3/member/{stateCode}`
*   **Parameter**: `{stateCode}` (e.g., CA)

**Python Example (Claude Code):**

```python
import requests

API_KEY = "DEMO_KEY"
BASE_URL = "https://api.congress.gov/v3"
STATE_CODE = "CA"

response = requests.get(f"{BASE_URL}/member/{STATE_CODE}", params={"api_key": API_KEY, "format": "json"})
data = response.json()

print(data)
```

#### 5.7. List Members by State and District

Retrieve a list of members filtered by state and congressional district.

*   **URL**: `https://api.congress.gov/v3/member/{stateCode}/{district}`
*   **Parameters**:
    *   `{stateCode}` (e.g., CA)
    *   `{district}` (e.g., 12)

**Python Example (Claude Code):**

```python
import requests

API_KEY = "DEMO_KEY"
BASE_URL = "https://api.congress.gov/v3"
STATE_CODE = "CA"
DISTRICT = 12

response = requests.get(f"{BASE_URL}/member/{STATE_CODE}/{DISTRICT}", params={"api_key": API_KEY, "format": "json"})
data = response.json()

print(data)
```

#### 5.8. List Members by Congress, State, and District

Retrieve a list of members filtered by Congress, state, and congressional district.

*   **URL**: `https://api.congress.gov/v3/member/congress/{congress}/{stateCode}/{district}`
*   **Parameters**:
    *   `{congress}` (e.g., 118)
    *   `{stateCode}` (e.g., TX)
    *   `{district}` (e.g., 15)

**Python Example (Claude Code):**

```python
import requests

API_KEY = "DEMO_KEY"
BASE_URL = "https://api.congress.gov/v3"
CONGRESS = 118
STATE_CODE = "TX"
DISTRICT = 15

response = requests.get(f"{BASE_URL}/member/congress/{CONGRESS}/{STATE_CODE}/{DISTRICT}", params={"api_key": API_KEY, "format": "json", "currentMember": "true"})
data = response.json()

print(data)
```

### 6. Committee Endpoint

The Committee endpoint provides information about congressional committees.

**Base URL**: `/committee`

#### 6.1. List All Committees

This endpoint returns a list of all congressional committees.

*   **URL**: `https://api.congress.gov/v3/committee`

**Python Example (Claude Code):**

```python
import requests

API_KEY = "DEMO_KEY"
BASE_URL = "https://api.congress.gov/v3"

response = requests.get(f"{BASE_URL}/committee", params={"api_key": API_KEY, "format": "json"})
data = response.json()

print(data)
```

#### 6.2. Get a Specific Committee

Retrieve detailed information for a specific committee.

*   **URL**: `https://api.congress.gov/v3/committee/{chamber}/{committeeCode}`
*   **Parameters**:
    *   `{chamber}` (e.g., house)
    *   `{committeeCode}` (e.g., hsju)

**Python Example (Claude Code):**

```python
import requests

API_KEY = "DEMO_KEY"
BASE_URL = "https://api.congress.gov/v3"
CHAMBER = "house"
COMMITTEE_CODE = "hsju"

response = requests.get(f"{BASE_URL}/committee/{CHAMBER}/{COMMITTEE_CODE}", params={"api_key": API_KEY, "format": "json"})
data = response.json()

print(data)
```

**Sample JSON Response (Partial):**

```json
{
  "committee": {
    "chamber": "House",
    "code": "HSJU",
    "name": "House Committee on the Judiciary",
    "url": "https://judiciary.house.gov/"
  }
}
```

### 7. House Vote Endpoint (Beta)

The House Vote endpoint provides information about roll call votes in the House of Representatives. This endpoint is currently in beta.

**Base URL**: `/house-vote`

#### 7.1. List All House Votes

This endpoint returns a list of all House roll call votes.

*   **URL**: `https://api.congress.gov/v3/house-vote`

**Python Example (Claude Code):**

```python
import requests

API_KEY = "DEMO_KEY"
BASE_URL = "https://api.congress.gov/v3"

response = requests.get(f"{BASE_URL}/house-vote", params={"api_key": API_KEY, "format": "json"})
data = response.json()

print(data)
```

#### 7.2. List House Votes by Congress

Filter House votes by a specific Congress.

*   **URL**: `https://api.congress.gov/v3/house-vote/{congress}`
*   **Parameter**: `{congress}` (e.g., 118)

**Python Example (Claude Code):**

```python
import requests

API_KEY = "DEMO_KEY"
BASE_URL = "https://api.congress.gov/v3"
CONGRESS = 118

response = requests.get(f"{BASE_URL}/house-vote/{CONGRESS}", params={"api_key": API_KEY, "format": "json"})
data = response.json()

print(data)
```

#### 7.3. List House Votes by Congress and Session

Filter House votes by Congress and session.

*   **URL**: `https://api.congress.gov/v3/house-vote/{congress}/{session}`
*   **Parameters**:
    *   `{congress}` (e.g., 118)
    *   `{session}` (e.g., 1)

**Python Example (Claude Code):**

```python
import requests

API_KEY = "DEMO_KEY"
BASE_URL = "https://api.congress.gov/v3"
CONGRESS = 118
SESSION = 1

response = requests.get(f"{BASE_URL}/house-vote/{CONGRESS}/{SESSION}", params={"api_key": API_KEY, "format": "json"})
data = response.json()

print(data)
```

#### 7.4. Get a Specific House Vote

Retrieve detailed information for a specific House roll call vote.

*   **URL**: `https://api.congress.gov/v3/house-vote/{congress}/{session}/{voteNumber}`
*   **Parameters**:
    *   `{congress}` (e.g., 118)
    *   `{session}` (e.g., 1)
    *   `{voteNumber}` (e.g., 100)

**Python Example (Claude Code):**

```python
import requests

API_KEY = "DEMO_KEY"
BASE_URL = "https://api.congress.gov/v3"
CONGRESS = 118
SESSION = 1
VOTE_NUMBER = 100

response = requests.get(f"{BASE_URL}/house-vote/{CONGRESS}/{SESSION}/{VOTE_NUMBER}", params={"api_key": API_KEY, "format": "json"})
data = response.json()

print(data)
```

#### 7.5. Get Member Votes for a Specific House Vote

Retrieve information about how members voted on a specific House roll call vote.

*   **URL**: `https://api.congress.gov/v3/house-vote/{congress}/{session}/{voteNumber}/members`
*   **Parameters**:
    *   `{congress}` (e.g., 118)
    *   `{session}` (e.g., 1)
    *   `{voteNumber}` (e.g., 100)

**Python Example (Claude Code):**

```python
import requests

API_KEY = "DEMO_KEY"
BASE_URL = "https://api.congress.gov/v3"
CONGRESS = 118
SESSION = 1
VOTE_NUMBER = 100

response = requests.get(f"{BASE_URL}/house-vote/{CONGRESS}/{SESSION}/{VOTE_NUMBER}/members", params={"api_key": API_KEY, "format": "json"})
data = response.json()

print(data)
```

### 9. Daily Congressional Record Endpoint

The Daily Congressional Record endpoint provides access to the official record of congressional proceedings.

**Base URL**: `/daily-congressional-record`

#### 9.1. List All Daily Congressional Record Issues

This endpoint returns a list of daily Congressional Record issues, sorted by most recent.

*   **URL**: `https://api.congress.gov/v3/daily-congressional-record`

**Python Example (Claude Code):**

```python
import requests

API_KEY = "DEMO_KEY"
BASE_URL = "https://api.congress.gov/v3"

response = requests.get(f"{BASE_URL}/daily-congressional-record", params={"api_key": API_KEY, "format": "json"})
data = response.json()

print(data)
```

#### 9.2. List Daily Congressional Records by Volume

Filter Congressional Record issues by volume number.

*   **URL**: `https://api.congress.gov/v3/daily-congressional-record/{volumeNumber}`
*   **Parameter**: `{volumeNumber}` (e.g., 169)

**Python Example (Claude Code):**

```python
import requests

API_KEY = "DEMO_KEY"
BASE_URL = "https://api.congress.gov/v3"
VOLUME_NUMBER = 169

response = requests.get(f"{BASE_URL}/daily-congressional-record/{VOLUME_NUMBER}", params={"api_key": API_KEY, "format": "json"})
data = response.json()

print(data)
```

#### 9.3. Get a Specific Daily Congressional Record Issue

Retrieve a specific Congressional Record issue by volume and issue number.

*   **URL**: `https://api.congress.gov/v3/daily-congressional-record/{volumeNumber}/{issueNumber}`
*   **Parameters**:
    *   `{volumeNumber}` (e.g., 169)
    *   `{issueNumber}` (e.g., 10)

**Python Example (Claude Code):**

```python
import requests

API_KEY = "DEMO_KEY"
BASE_URL = "https://api.congress.gov/v3"
VOLUME_NUMBER = 169
ISSUE_NUMBER = 10

response = requests.get(f"{BASE_URL}/daily-congressional-record/{VOLUME_NUMBER}/{ISSUE_NUMBER}", params={"api_key": API_KEY, "format": "json"})
data = response.json()

print(data)
```

#### 9.4. Get Articles from a Congressional Record Issue

Retrieve articles from a specific Congressional Record issue.

*   **URL**: `https://api.congress.gov/v3/daily-congressional-record/{volumeNumber}/{issueNumber}/articles`
*   **Parameters**:
    *   `{volumeNumber}` (e.g., 169)
    *   `{issueNumber}` (e.g., 10)

**Python Example (Claude Code):**

```python
import requests

API_KEY = "DEMO_KEY"
BASE_URL = "https://api.congress.gov/v3"
VOLUME_NUMBER = 169
ISSUE_NUMBER = 10

response = requests.get(f"{BASE_URL}/daily-congressional-record/{VOLUME_NUMBER}/{ISSUE_NUMBER}/articles", params={"api_key": API_KEY, "format": "json"})
data = response.json()

print(data)
```

### 10. Other Endpoints

This section provides a brief overview of the remaining endpoints available in the Congress.gov API.

*   **Committee Report (`/committee-report`)**: Provides access to committee reports.
*   **Committee Print (`/committee-print`)**: Provides access to committee prints.
*   **Committee Meeting (`/committee-meeting`)**: Provides information about committee meetings.
*   **Hearing (`/hearing`)**: Provides information about congressional hearings.
*   **Daily Congressional Record (`/daily-congressional-record`)**: Provides access to the daily Congressional Record.
*   **Bound Congressional Record (`/bound-congressional-record`)**: Provides access to the bound Congressional Record.
*   **House Communication (`/house-communication`)**: Provides access to communications to the House.
*   **Senate Communication (`/senate-communication`)**: Provides access to communications to the Senate.
*   **House Requirement (`/house-requirement`)**: Provides information about House requirements.
*   **Nomination (`/nomination`)**: Provides information about presidential nominations.
*   **Treaty (`/treaty`)**: Provides information about treaties.
*   **CRS Report (`/crs-report`)**: Provides access to Congressional Research Service reports.

## Conclusion

This guide has provided a comprehensive overview of the Congress.gov API and its various endpoints. By following the examples and documentation provided, you can effectively retrieve and utilize a vast amount of legislative data for your applications.

## References

[1] Library of Congress. (n.d.). *api.congress.gov*. GitHub. Retrieved November 15, 2025, from https://github.com/LibraryOfCongress/api.congress.gov

### 8. Law Endpoint

The Law endpoint provides information about bills that have been enacted into law.

**Base URL**: `/law`

#### 8.1. List Laws by Congress

This endpoint returns a list of laws for a specific Congress.

*   **URL**: `https://api.congress.gov/v3/law/{congress}`
*   **Parameter**: `{congress}` (e.g., 117)

**Python Example (Claude Code):**

```python
import requests

API_KEY = "DEMO_KEY"
BASE_URL = "https://api.congress.gov/v3"
CONGRESS = 117

response = requests.get(f"{BASE_URL}/law/{CONGRESS}", params={"api_key": API_KEY, "format": "json"})
data = response.json()

print(data)
```

#### 8.2. List Laws by Congress and Type

Filter laws by Congress and type (public or private).

*   **URL**: `https://api.congress.gov/v3/law/{congress}/{lawType}`
*   **Parameters**:
    *   `{congress}` (e.g., 117)
    *   `{lawType}` (e.g., public)

**Python Example (Claude Code):**

```python
import requests

API_KEY = "DEMO_KEY"
BASE_URL = "https://api.congress.gov/v3"
CONGRESS = 117
LAW_TYPE = "public"

response = requests.get(f"{BASE_URL}/law/{CONGRESS}/{LAW_TYPE}", params={"api_key": API_KEY, "format": "json"})
data = response.json()

print(data)
```

#### 8.3. Get a Specific Law

Retrieve detailed information for a specific law.

*   **URL**: `https://api.congress.gov/v3/law/{congress}/{lawType}/{lawNumber}`
*   **Parameters**:
    *   `{congress}` (e.g., 117)
    *   `{lawType}` (e.g., public)
    *   `{lawNumber}` (e.g., 108)

**Python Example (Claude Code):**

```python
import requests

API_KEY = "DEMO_KEY"
BASE_URL = "https://api.congress.gov/v3"
CONGRESS = 117
LAW_TYPE = "public"
LAW_NUMBER = 108

response = requests.get(f"{BASE_URL}/law/{CONGRESS}/{LAW_TYPE}/{LAW_NUMBER}", params={"api_key": API_KEY, "format": "json"})
data = response.json()

print(data)
```

**Sample JSON Response (Partial):**

```json
{
  "laws": [
    {
      "congress": 117,
      "number": "108",
      "type": "Public",
      "url": "https://api.congress.gov/v3/bill/117/hr/3076?format=json"
    }
  ]
}
```
