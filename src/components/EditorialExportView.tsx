import React from 'react';
import { VoyageData } from '../types';
import { EditorialOrientationMode } from '../cartography/composition';
import { EditorialPaperSize } from '../export/editorialOutput';
import { EditorialContent, GapDisplayAdjustment } from '../project/nlroute';
import { EditorialMapPreview } from './EditorialMapPreview';
import { EditorialContentEditor } from './EditorialContentEditor';
import { EditorialOutputControls } from './EditorialOutputControls';

type Props={voyage:VoyageData;gapAdjustments:GapDisplayAdjustment[];editorial:EditorialContent;onEditorialChange:(next:EditorialContent)=>void};
export const EditorialExportView:React.FC<Props>=({voyage,gapAdjustments,editorial,onEditorialChange})=>{const[size,setSize]=React.useState<EditorialPaperSize>('A5');const[orientationMode,setOrientationMode]=React.useState<EditorialOrientationMode>('auto');return <div className="w-full h-full overflow-y-auto bg-[#f4f1e9] p-6"><div className="max-w-7xl mx-auto flex gap-5 items-start"><div className="w-[300px] shrink-0 space-y-4"><EditorialContentEditor value={editorial} onChange={onEditorialChange}/><EditorialOutputControls voyage={voyage} size={size} onSizeChange={setSize} orientationMode={orientationMode} onOrientationModeChange={setOrientationMode}/></div><div className="min-w-0 flex-1"><EditorialMapPreview voyage={voyage} gapAdjustments={gapAdjustments} editorial={editorial} orientationMode={orientationMode}/></div></div></div>};
