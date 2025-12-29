import { createClient } from 'next-sanity'

export const client = createClient({
  projectId: 's583epdw',
  dataset: 'production',
  apiVersion: '2024-01-01',
  useCdn: true, // Enable CDN for faster, cached content
})
