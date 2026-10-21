'use client'

/**
 * This configuration is used to for the Sanity Studio that’s mounted on the `\app\studio\[[...tool]]\page.tsx` route
 */

import {visionTool} from '@sanity/vision'
import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'

// Go to https://www.sanity.io/docs/api-versioning to learn how API versioning works
import {apiVersion, dataset, projectId} from './sanity/env'
import {schema} from './sanity/schemaTypes'
import {SINGLETON_TYPES} from './sanity/singletons'
import {structure} from './sanity/structure'

// A one-page document (see ./sanity/singletons) can be edited and published, but not duplicated,
// deleted or created a second time from the "+" menu.
const SINGLETON_ACTIONS = new Set(['publish', 'discardChanges', 'restore'])

export default defineConfig({
  basePath: '/studio',
  projectId,
  dataset,
  // Add and edit the content schema in the './sanity/schemaTypes' folder
  schema,
  document: {
    newDocumentOptions: (prev, {creationContext}) =>
      creationContext.type === 'global' ? prev.filter((item) => !SINGLETON_TYPES.has(item.templateId)) : prev,
    actions: (prev, {schemaType}) =>
      SINGLETON_TYPES.has(schemaType) ? prev.filter(({action}) => action != null && SINGLETON_ACTIONS.has(action)) : prev,
  },
  plugins: [
    structureTool({structure}),
    ...(process.env.NODE_ENV !== 'production' ? [visionTool({defaultApiVersion: apiVersion})] : []),
  ],
})
