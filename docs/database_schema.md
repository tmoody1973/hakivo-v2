# Congress.gov API Database Schema

This document outlines a relational database schema designed to store data retrieved from the Congress.gov API. The schema is normalized to reduce redundancy and improve data integrity.

## Table of Contents

1.  [Core Tables](#core-tables)
    *   [Congresses](#congresses-table)
    *   [Members](#members-table)
    *   [Bills](#bills-table)
    *   [Amendments](#amendments-table)
2.  [Committee Tables](#committee-tables)
    *   [Committees](#committees-table)
    *   [Committee Meetings](#committee-meetings-table)
    *   [Committee Reports](#committee-reports-table)
    *   [Committee Prints](#committee-prints-table)
3.  [Voting and Actions Tables](#voting-and-actions-tables)
    *   [Actions](#actions-table)
    *   [Votes](#votes-table)
4.  [Other Legislative Tables](#other-legislative-tables)
    *   [Nominations](#nominations-table)
    *   [Treaties](#treaties-table)
    *   [Communications](#communications-table)

---

## Core Tables

### Congresses Table

Stores information about each Congress.

| Column Name | Data Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | Primary Key. The Congress number (e.g., 118). |
| `name` | TEXT | The name of the Congress (e.g., "118th Congress"). |
| `start_year` | INTEGER | The start year of the Congress. |
| `end_year` | INTEGER | The end year of the Congress. |

### Members Table

Stores information about members of Congress.

| Column Name | Data Type | Description |
| :--- | :--- | :--- |
| `bioguide_id` | TEXT | Primary Key. The unique ID for the member. |
| `first_name` | TEXT | The member's first name. |
| `last_name` | TEXT | The member's last name. |
| `party` | TEXT | The member's political party. |
| `state` | TEXT | The state the member represents. |
| `district` | INTEGER | The congressional district. |
| `url` | TEXT | The URL to the member's page on Congress.gov. |

### Bills Table

Stores information about each bill.

| Column Name | Data Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | Primary Key. Auto-incrementing ID. |
| `congress_id` | INTEGER | Foreign Key to `Congresses.id`. |
| `bill_type` | TEXT | The type of bill (e.g., HR, S). |
| `bill_number` | INTEGER | The number of the bill. |
| `title` | TEXT | The official title of the bill. |
| `origin_chamber` | TEXT | The chamber where the bill originated (House or Senate). |
| `introduced_date` | DATE | The date the bill was introduced. |
| `latest_action_date` | DATE | The date of the latest action on the bill. |
| `latest_action_text` | TEXT | The text of the latest action. |
| `sponsor_bioguide_id` | TEXT | Foreign Key to `Members.bioguide_id`. |
| `text` | TEXT | The full text of the bill. |

### Amendments Table

Stores information about amendments to bills.

| Column Name | Data Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | Primary Key. Auto-incrementing ID. |
| `congress_id` | INTEGER | Foreign Key to `Congresses.id`. |
| `amendment_type` | TEXT | The type of amendment (e.g., HAMDT, SAMDT). |
| `amendment_number` | INTEGER | The number of the amendment. |
| `bill_id` | INTEGER | Foreign Key to `Bills.id`. The bill being amended. |
| `sponsor_bioguide_id` | TEXT | Foreign Key to `Members.bioguide_id`. |
| `purpose` | TEXT | The purpose of the amendment. |
| `description` | TEXT | A description of the amendment. |
| `latest_action_date` | DATE | The date of the latest action on the amendment. |
| `latest_action_text` | TEXT | The text of the latest action. |

## Bill Relationship Tables

These tables handle the many-to-many relationships between bills and other entities like committees, members (cosponsors), and subjects.

### Bill Committees (Junction Table)

Links bills to the committees that are associated with them.

| Column Name | Data Type | Description |
| :--- | :--- | :--- |
| `bill_id` | INTEGER | Foreign Key to `Bills.id`. |
| `committee_id` | TEXT | Foreign Key to `Committees.id`. |

### Bill Cosponsors (Junction Table)

Links bills to their cosponsors.

| Column Name | Data Type | Description |
| :--- | :--- | :--- |
| `bill_id` | INTEGER | Foreign Key to `Bills.id`. |
| `member_bioguide_id` | TEXT | Foreign Key to `Members.bioguide_id`. |

### Related Bills (Junction Table)

Creates a relationship between bills that are related to each other.

| Column Name | Data Type | Description |
| :--- | :--- | :--- |
| `bill_id` | INTEGER | Foreign Key to `Bills.id`. |
| `related_bill_id` | INTEGER | Foreign Key to `Bills.id` (the related bill). |

### Subjects Table

Stores legislative subjects.

| Column Name | Data Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | Primary Key. Auto-incrementing ID. |
| `name` | TEXT | The name of the subject. |

### Bill Subjects (Junction Table)

Links bills to their legislative subjects.

| Column Name | Data Type | Description |
| :--- | :--- | :--- |
| `bill_id` | INTEGER | Foreign Key to `Bills.id`. |
| `subject_id` | INTEGER | Foreign Key to `Subjects.id`. |

### Laws Table

Stores information about bills that have become law.

| Column Name | Data Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | Primary Key. Auto-incrementing ID. |
| `bill_id` | INTEGER | Foreign Key to `Bills.id`. |
| `congress_id` | INTEGER | Foreign Key to `Congresses.id`. |
| `law_type` | TEXT | The type of law (Public or Private). |
| `law_number` | INTEGER | The assigned law number. |

## Voting and Actions Tables

### Actions Table

Stores actions taken on bills and amendments.

| Column Name | Data Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | Primary Key. Auto-incrementing ID. |
| `bill_id` | INTEGER | Foreign Key to `Bills.id`. Nullable if action is on amendment. |
| `amendment_id` | INTEGER | Foreign Key to `Amendments.id`. Nullable if action is on bill. |
| `action_date` | DATE | The date of the action. |
| `action_text` | TEXT | The description of the action. |
| `action_time` | TIME | The time of the action (if available). |

### Votes Table

Stores information about House roll call votes.

| Column Name | Data Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | Primary Key. Auto-incrementing ID. |
| `congress_id` | INTEGER | Foreign Key to `Congresses.id`. |
| `session` | INTEGER | The session number (1 or 2). |
| `vote_number` | INTEGER | The roll call vote number. |
| `bill_id` | INTEGER | Foreign Key to `Bills.id`. Nullable if not related to a bill. |
| `vote_date` | DATE | The date of the vote. |
| `vote_question` | TEXT | The question being voted on. |
| `vote_result` | TEXT | The result of the vote (e.g., Passed, Failed). |

### Vote Members (Junction Table)

Stores how individual members voted on a specific vote.

| Column Name | Data Type | Description |
| :--- | :--- | :--- |
| `vote_id` | INTEGER | Foreign Key to `Votes.id`. |
| `member_bioguide_id` | TEXT | Foreign Key to `Members.bioguide_id`. |
| `vote_cast` | TEXT | How the member voted (e.g., Yea, Nay, Present, Not Voting). |

## Congressional Record Tables

### Congressional Record Issues Table

Stores information about daily Congressional Record issues.

| Column Name | Data Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | Primary Key. Auto-incrementing ID. |
| `volume_number` | INTEGER | The volume number of the Congressional Record. |
| `issue_number` | INTEGER | The issue number within the volume. |
| `issue_date` | DATE | The date of the Congressional Record issue. |
| `congress_id` | INTEGER | Foreign Key to `Congresses.id`. |
| `session_number` | INTEGER | The session number (1 or 2). |

### Congressional Record Articles Table

Stores individual articles from Congressional Record issues.

| Column Name | Data Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | Primary Key. Auto-incrementing ID. |
| `record_issue_id` | INTEGER | Foreign Key to `Congressional Record Issues.id`. |
| `title` | TEXT | The title of the article. |
| `article_type` | TEXT | The type of article (e.g., Senate, House, Extensions of Remarks). |
| `start_page` | TEXT | The starting page number. |
| `end_page` | TEXT | The ending page number. |
| `content` | TEXT | The full text content of the article. |
