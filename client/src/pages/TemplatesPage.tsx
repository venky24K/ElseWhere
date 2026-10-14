import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutTemplate,
  Search,
  ArrowRight,
  FileText,
} from 'lucide-react';
import { TEMPLATES, type Template } from '../templates';
import { useProjectStore } from '../store/useProjectStore';

export function TemplatesPage() {
  const navigate = useNavigate();
  const createProject = useProjectStore((s) => s.createProject);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const categories = ['All', 'Paper', 'Presentation', 'Document'];

  const filteredTemplates = useMemo(() => {
    return TEMPLATES.filter((tpl) => {
      const matchesCategory = selectedCategory === 'All' || tpl.category === selectedCategory;
      const matchesSearch =
        tpl.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tpl.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

  const handleUseTemplate = (tpl: Template) => {
    const newId = createProject(tpl.name, tpl.description, tpl.id);
    navigate(`/project/${newId}`);
  };

  return (
    <div className="flex flex-col w-full py-12 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto space-y-10">
      {/* Header */}
      <div className="text-center space-y-3 max-w-3xl mx-auto">
        <span className="text-xs font-bold uppercase tracking-wider text-brand px-3 py-1 rounded-full bg-brand/10 border border-brand/20">
          Template Marketplace
        </span>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-text-primary tracking-tight">
          Starter Templates for Every Discipline
        </h1>
        <p className="text-sm text-text-secondary leading-relaxed">
          Pre-formatted with industry-standard publication styles, optimal geometries, mathematical packages, and clean bibtex configurations.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl border border-border-subtle bg-sidebar shadow-xs">
        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-brand text-white shadow-xs font-semibold'
                  : 'bg-card text-text-secondary hover:text-text-primary hover:bg-card-hover border border-border-subtle'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-border-subtle bg-card text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand transition-colors"
          />
        </div>
      </div>

      {/* Template Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTemplates.map((tpl) => (
          <div
            key={tpl.id}
            className="rounded-2xl border border-border-subtle bg-sidebar hover:border-brand/40 hover:shadow-lg transition-all p-6 flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-brand/10 text-brand">
                  {tpl.category}
                </span>
                <span className="text-xs text-text-muted flex items-center gap-1">
                  <FileText size={12} />
                  {tpl.files.length} file{tpl.files.length > 1 ? 's' : ''}
                </span>
              </div>

              <div>
                <h3 className="text-base font-bold text-text-primary">{tpl.name}</h3>
                <p className="text-xs text-text-secondary leading-relaxed mt-1.5 line-clamp-3">
                  {tpl.description}
                </p>
              </div>

              {/* Code Snippet Peek */}
              <div className="p-3 rounded-lg bg-app border border-border-subtle text-[11px] font-mono text-text-secondary overflow-hidden max-h-24 select-none">
                <pre className="overflow-hidden text-ellipsis line-clamp-3">
                  {tpl.files[0]?.content.slice(0, 200)}
                </pre>
              </div>
            </div>

            <div className="pt-5 border-t border-border-subtle mt-6 flex items-center justify-between">
              <span className="text-[11px] text-text-muted font-mono">{tpl.files[0]?.path}</span>
              <button
                type="button"
                onClick={() => handleUseTemplate(tpl)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-brand hover:bg-brand-hover text-white transition-all shadow-xs cursor-pointer"
              >
                <span>Open in Studio</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        ))}

        {filteredTemplates.length === 0 && (
          <div className="col-span-full py-16 text-center text-text-muted space-y-2">
            <LayoutTemplate size={32} className="mx-auto opacity-40" />
            <p className="text-sm font-medium">No templates found matching your search.</p>
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('All');
                setSearchQuery('');
              }}
              className="text-xs text-brand hover:underline cursor-pointer"
            >
              Reset all filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default TemplatesPage;
