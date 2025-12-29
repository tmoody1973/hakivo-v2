import {defineCliConfig} from 'sanity/cli'

export default defineCliConfig({
  api: {
    projectId: 's583epdw',
    dataset: 'production'
  },
  deployment: {
    appId: 'eyvttcq2alqc1lw8fsnlve7c',
    /**
     * Enable auto-updates for studios.
     * Learn more at https://www.sanity.io/docs/cli#auto-updates
     */
    autoUpdates: true,
  }
})
