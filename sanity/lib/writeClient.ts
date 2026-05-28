import { createClient } from 'next-sanity'
import { apiVersion, dataset, projectId } from '../env'

// Server-only — never import this in 'use client' components
export function getWriteClient() {
  return createClient({
    projectId,
    dataset,
    apiVersion,
    useCdn: false,
    token: process.env.SANITY_API_WRITE_TOKEN,
  })
}
