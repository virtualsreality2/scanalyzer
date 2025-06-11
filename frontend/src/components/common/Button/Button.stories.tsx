import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';
import { Plus, ChevronRight, Download, Trash2, ExternalLink } from 'lucide-react';

const meta = {
  title: 'Components/Button',
  component: Button,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A versatile button component with multiple variants, sizes, and states.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      description: 'The visual style variant of the button',
    },
    size: {
      control: { type: 'select' },
      description: 'The size of the button',
    },
    rounded: {
      control: { type: 'select' },
      description: 'The border radius style',
    },
    fullWidth: {
      control: { type: 'boolean' },
      description: 'Whether the button should take full width of its container',
    },
    loading: {
      control: { type: 'boolean' },
      description: 'Shows a loading spinner and disables the button',
    },
    disabled: {
      control: { type: 'boolean' },
      description: 'Disables the button',
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: 'Button',
  },
};

export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="danger">Danger</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="link">Link</Button>
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
    </div>
  ),
};

export const WithIcons: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Button leftIcon={<Plus className="h-4 w-4" />}>Add Item</Button>
      <Button rightIcon={<ChevronRight className="h-4 w-4" />}>Next</Button>
      <Button
        leftIcon={<Download className="h-4 w-4" />}
        rightIcon={<ExternalLink className="h-4 w-4" />}
      >
        Download Report
      </Button>
      <Button size="icon" aria-label="Add">
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  ),
};

export const Loading: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Button loading>Loading...</Button>
      <Button loading variant="secondary">Processing</Button>
      <Button loading size="sm">Small</Button>
      <Button loading size="lg">Large Loading</Button>
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Button disabled>Disabled</Button>
      <Button disabled variant="secondary">Disabled Secondary</Button>
      <Button disabled variant="danger">Disabled Danger</Button>
      <Button disabled leftIcon={<Plus className="h-4 w-4" />}>
        Disabled with Icon
      </Button>
    </div>
  ),
};

export const BorderRadius: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Button rounded="none">No Radius</Button>
      <Button rounded="sm">Small Radius</Button>
      <Button rounded="md">Medium Radius</Button>
      <Button rounded="lg">Large Radius</Button>
      <Button rounded="full">Full Radius</Button>
    </div>
  ),
};

export const FullWidth: Story = {
  render: () => (
    <div className="w-96 space-y-4">
      <Button fullWidth>Full Width Button</Button>
      <Button fullWidth variant="secondary">Full Width Secondary</Button>
      <Button fullWidth size="lg" leftIcon={<Download className="h-5 w-5" />}>
        Download All Reports
      </Button>
    </div>
  ),
};

export const SecurityActions: Story = {
  name: 'Security Actions (Use Case)',
  render: () => (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Report Actions</h3>
        <div className="flex gap-2">
          <Button leftIcon={<Download className="h-4 w-4" />}>
            Export Findings
          </Button>
          <Button variant="secondary">View Details</Button>
          <Button variant="ghost">Dismiss</Button>
        </div>
      </div>
      
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Severity Actions</h3>
        <div className="flex gap-2">
          <Button variant="danger" leftIcon={<Trash2 className="h-4 w-4" />}>
            Delete Critical
          </Button>
          <Button variant="secondary">Acknowledge High</Button>
          <Button variant="ghost">Review Medium</Button>
        </div>
      </div>
      
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Icon Buttons</h3>
        <div className="flex gap-2">
          <Button size="icon" variant="ghost" aria-label="Add finding">
            <Plus className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" aria-label="Download">
            <Download className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" aria-label="Delete">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  ),
};

export const Interactive: Story = {
  args: {
    children: 'Click me!',
    onClick: () => alert('Button clicked!'),
  },
};