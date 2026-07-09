/** @type {import('@storybook/web-components-vite').StorybookConfig} */
export default {
  stories: ['../stories/**/*.mdx', '../stories/**/*.stories.js'],
  addons: ['@storybook/addon-essentials', '@storybook/addon-a11y'],
  framework: { name: '@storybook/web-components-vite', options: {} },
};
