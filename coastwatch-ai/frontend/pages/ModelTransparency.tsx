
import React, { useEffect, useState } from 'react';
import {
    Shield, Database, Cpu, AlertTriangle, ChevronDown, ChevronUp,
    ExternalLink, CheckCircle, Info, Loader2, Target, Bird, Droplets,
} from 'lucide-react';
import { api } from '../services/api';

const fmtNum = (n: number) => n.toLocaleString();

const barColor = (val: number) => {
    if (val >= 0.88) return '#10b981';
    if (val >= 0.78) return '#f59e0b';
    return '#f97316';
};

const sourceTypeIcons: Record<string, any> = {
    public_dataset: Database,
    satellite: Target,
    drone_imagery: Bird,
    camera_trap: Droplets,
};

const sourceTypeColors: Record<string, string> = {
    public_dataset: 'bg-blue-50 text-blue-600',
    satellite: 'bg-violet-50 text-violet-600',
    drone_imagery: 'bg-teal-50 text-teal-600',
    camera_trap: 'bg-emerald-50 text-emerald-600',
};

const ModelTransparency: React.FC = () => {
    const [modelCard, setModelCard] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [expandedSource, setExpandedSource] = useState<number | null>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'classes' | 'data' | 'limitations'>('overview');

    useEffect(() => {
        api.getModelCard()
            .then(d => { setModelCard(d); setLoading(false); })
            .catch(e => { console.error(e); setLoading(false); });
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="text-center">
                    <Loader2 size={36} className="text-teal-500 animate-spin mx-auto mb-3" />
                    <p className="text-slate-500 font-bold text-sm">Loading transparency card...</p>
                </div>
            </div>
        );
    }

    if (!modelCard) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="text-center opacity-50">
                    <AlertTriangle size={32} className="mx-auto text-amber-400 mb-2" />
                    <p className="text-sm text-slate-500 font-bold">Could not load model card</p>
                </div>
            </div>
        );
    }

    const byCategory = {
        '🦅 Bird Species': (modelCard.class_performance || []).filter((c: any) => !['nest_active', 'nest_inactive', 'egg_clutch', 'chick', 'fledgling', 'oil_sheen', 'oil_slick', 'flood_inundation', 'habitat_erosion', 'predator_mammal'].includes(c.name)),
        '🪺 Life Stages': (modelCard.class_performance || []).filter((c: any) => ['nest_active', 'nest_inactive', 'egg_clutch', 'chick', 'fledgling'].includes(c.name)),
        '⚠️ Threats': (modelCard.class_performance || []).filter((c: any) => ['oil_sheen', 'oil_slick', 'flood_inundation', 'habitat_erosion', 'predator_mammal'].includes(c.name)),
    };

    const totalTraining = (modelCard.dataset_sources || []).reduce((s: number, d: any) => s + d.image_count, 0);

    return (
        <div className="space-y-6 pb-8">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                            <Shield size={22} />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-800">Model Transparency Card</h2>
                    </div>
                    <p className="text-slate-400 text-sm ml-1">
                        Complete training data provenance, per-class performance, and known limitations for PelicanEye judges and conservation partners.
                    </p>
                </div>
                <span className="text-[10px] font-black uppercase px-3 py-1.5 bg-teal-50 text-teal-600 border border-teal-200 rounded-full">
                    v{modelCard.version}
                </span>
            </div>

            {/* Tab Row */}
            <div className="flex gap-1.5 bg-slate-100 p-1.5 rounded-2xl w-fit">
                {(['overview', 'classes', 'data', 'limitations'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 text-xs font-bold capitalize rounded-xl transition-all ${activeTab === tab ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        {tab === 'overview' ? '📋 Overview' : tab === 'classes' ? '🎯 Class Performance' : tab === 'data' ? '🗄️ Training Data' : '⚠️ Limitations'}
                    </button>
                ))}
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && (
                <div className="space-y-5">
                    {/* Model Identity */}
                    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                        <h3 className="text-base font-bold text-slate-800 mb-4">Model Identity</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[
                                { label: 'Model Name', value: modelCard.model_name },
                                { label: 'Architecture', value: modelCard.model_architecture },
                                { label: 'Current Demo Base', value: modelCard.base_model },
                                { label: 'Geographic Scope', value: modelCard.geographic_scope },
                                { label: 'Label Strategy', value: modelCard.label_strategy },
                                { label: 'Monitoring Partner', value: modelCard.monitoring_partner },
                            ].map((f, i) => (
                                <div key={i} className="bg-slate-50 p-4 rounded-2xl">
                                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1">{f.label}</p>
                                    <p className="text-sm text-slate-700 font-medium leading-snug">{f.value}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Metrics Overview */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { label: 'Overall mAP@0.5', value: `${(modelCard.overall_map50 * 100).toFixed(1)}%`, icon: Target, color: 'teal', sub: 'primary metric' },
                            { label: 'Overall F1', value: `${(modelCard.overall_f1 * 100).toFixed(1)}%`, icon: CheckCircle, color: 'emerald', sub: 'precision + recall' },
                            { label: 'Training Images', value: fmtNum(totalTraining), icon: Database, color: 'blue', sub: '6 curated sources' },
                            { label: 'Custom Classes', value: modelCard.total_classes, icon: Cpu, color: 'violet', sub: 'Louisiana-specific' },
                        ].map((m, i) => (
                            <div key={i} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm text-center">
                                <div className={`p-2 bg-${m.color}-50 text-${m.color}-600 rounded-xl inline-flex mb-3`}>
                                    <m.icon size={18} />
                                </div>
                                <p className="text-2xl font-black text-slate-800">{m.value}</p>
                                <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">{m.label}</p>
                                <p className="text-[8px] text-slate-300 font-medium mt-0.5">{m.sub}</p>
                            </div>
                        ))}
                    </div>

                    <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-start gap-3">
                        <Info size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-800">{modelCard.deployment_notes}</p>
                    </div>
                </div>
            )}

            {/* Classes Tab */}
            {activeTab === 'classes' && (
                <div className="space-y-6">
                    {Object.entries(byCategory).map(([category, classes]) => (
                        <div key={category} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                            <h3 className="text-base font-bold text-slate-800 mb-5">{category}</h3>
                            <div className="space-y-3.5">
                                {(classes as any[]).map((cls: any, i: number) => (
                                    <div key={i}>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-sm font-bold text-slate-700 font-mono">{cls.name}</span>
                                            <div className="flex items-center gap-4 text-[10px] font-bold">
                                                <span className="text-teal-600">P: {(cls.precision * 100).toFixed(0)}%</span>
                                                <span className="text-cyan-600">R: {(cls.recall * 100).toFixed(0)}%</span>
                                                <span className="text-violet-600">F1: {(cls.f1 * 100).toFixed(0)}%</span>
                                                <span className="text-slate-400">{fmtNum(cls.train_images)} imgs</span>
                                            </div>
                                        </div>
                                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                            <div className="h-full rounded-full transition-all" style={{ width: `${cls.f1 * 100}%`, backgroundColor: barColor(cls.f1) }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Data Tab */}
            {activeTab === 'data' && (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {Object.entries(
                            (modelCard.dataset_sources || []).reduce((acc: any, s: any) => { acc[s.type] = (acc[s.type] || 0) + s.image_count; return acc; }, {})
                        ).map(([type, count]: any) => {
                            const Icon = sourceTypeIcons[type] || Database;
                            return (
                                <div key={type} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
                                    <div className={`p-1.5 rounded-lg flex-shrink-0 ${sourceTypeColors[type] || 'bg-slate-50 text-slate-500'}`}>
                                        <Icon size={16} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-black text-slate-800">{fmtNum(count as number)}</p>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase">{type.replace('_', ' ')}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="space-y-3">
                        {(modelCard.dataset_sources || []).map((src: any, i: number) => {
                            const Icon = sourceTypeIcons[src.type] || Database;
                            const isOpen = expandedSource === i;
                            return (
                                <div key={i} className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                                    <button
                                        onClick={() => setExpandedSource(isOpen ? null : i)}
                                        className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-50/50 transition-colors"
                                    >
                                        <div className="flex items-center gap-4 min-w-0">
                                            <div className={`p-2 rounded-xl flex-shrink-0 ${sourceTypeColors[src.type] || 'bg-slate-50 text-slate-500'}`}>
                                                <Icon size={18} />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold text-slate-800 truncate">{src.name}</p>
                                                <div className="flex items-center gap-3 mt-0.5">
                                                    <span className="text-[10px] font-medium text-slate-400">{fmtNum(src.image_count)} images</span>
                                                    <span className="text-[10px] font-medium text-slate-300">·</span>
                                                    <span className="text-[10px] font-medium text-slate-400">{src.date_range}</span>
                                                    <span className="text-[10px] font-medium text-slate-300">·</span>
                                                    <span className="text-[10px] font-bold text-violet-500">{src.license}</span>
                                                </div>
                                            </div>
                                        </div>
                                        {isOpen ? <ChevronUp size={16} className="text-slate-400 flex-shrink-0" /> : <ChevronDown size={16} className="text-slate-400 flex-shrink-0" />}
                                    </button>
                                    {isOpen && (
                                        <div className="px-5 pb-5 border-t border-slate-50 bg-slate-50/30 pt-4 space-y-3">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <div>
                                                    <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Geographic Region</p>
                                                    <p className="text-xs text-slate-700 font-medium">{src.geographic_region}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Annotation Method</p>
                                                    <p className="text-xs text-slate-700 font-medium">{src.annotation_method}</p>
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-black uppercase text-slate-400 mb-1.5">Classes Covered</p>
                                                <div className="flex flex-wrap gap-1">
                                                    {src.classes_covered.map((cls: string, j: number) => (
                                                        <span key={j} className="text-[10px] font-mono bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded-lg">{cls}</span>
                                                    ))}
                                                </div>
                                            </div>
                                            {src.source_url !== 'Internal — DevDays 2024 Field Campaign' && (
                                                <a href={src.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-600 hover:text-teal-700">
                                                    <ExternalLink size={12} /> View Source
                                                </a>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Limitations Tab */}
            {activeTab === 'limitations' && (
                <div className="space-y-4">
                    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                        <h3 className="text-base font-bold text-slate-800 mb-4">Known Model Limitations</h3>
                        <div className="space-y-3">
                            {(modelCard.known_limitations || []).map((lim: string, i: number) => (
                                <div key={i} className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-2xl p-4">
                                    <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
                                    <p className="text-sm text-amber-900 font-medium leading-relaxed">{lim}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                        <h3 className="text-base font-bold text-slate-800 mb-4">Deployment Context</h3>
                        <p className="text-sm text-slate-600 leading-relaxed">{modelCard.deployment_notes}</p>
                        <div className="mt-4 p-4 bg-teal-50 border border-teal-100 rounded-2xl flex items-start gap-3">
                            <CheckCircle size={16} className="text-teal-600 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-bold text-teal-800">Production roadmap</p>
                                <p className="text-xs text-teal-700 mt-0.5">Custom Louisiana model targeting mAP@0.5 &gt; 0.85 on held-out test set before production deployment. Active learning loop prioritizes low-confidence detections for human review by LDWF ornithologists.</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ModelTransparency;
