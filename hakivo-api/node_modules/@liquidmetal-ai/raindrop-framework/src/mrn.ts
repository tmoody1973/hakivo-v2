/**
 * Represents the exploded object form of a Metal Resource Name (MRN) string.
 *
 * An MRN is a structured identifier format that can represent resources such
 * as annotations and labels within the system. This type provides the parsed
 * components of an MRN string broken down into its constituent parts.
 * a MRN string is structured as follows:
 * `type:applicationName:versionId:module:item^key:revision`
 *  NOTE: the `^` character is used to separate the key from the item. This allows keys to be overloaded to represent full module level keys and item level keys.
 *
 * @property {'annotation' | 'label'} type - The resource type
 * @property {string} applicationName - The name of the application
 * @property {string} versionId - The version identifier
 * @property {string} [module] - Optional module name
 * @property {string} [item] - Optional item identifier
 * @property {string} [key] - Optional key value
 * @property {string} [revision] - Optional revision identifier
 */
export type MRNObject = {
  type: 'annotation' | 'label';
  applicationName: string;
  versionId: string;
  module?: string;
  item?: string;
  key?: string;
  revision?: string;
};
