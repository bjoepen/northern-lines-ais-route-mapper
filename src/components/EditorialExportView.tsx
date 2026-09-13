import React from 'react';
import { VoyageData } from '../types';
import { EditorialContent, GapDisplayAdjustment } from '../project/nlroute';
import { EditorialMapPreview } from './EditorialMapPreview';
import { EditorialContentEditor } from './EditorialContentEditor';
type Props={voyage:VoyageData;gapAdjustments:GapDisplayAdjustment[];editorial:EditorialContent;onEditorialChange:(next:EditorialContent)=>void};
export const EditorialExportView:React.FC<Props>=({voyage,gapAdjustments,editorial,onEditorialChange})=><div className="w-full h-full overflow-y-auto bg-[#f4f1e9] p-6"><div className="max-w-7xl mx-auto flex gap-5 items-start"><div className="w-[300px] shrink-0"><EditorialContentEditor value={editorial} onChange={onEditorialChange}/></div><div className="min-w-0 flex-1"><EditorialMapPreview voyage={voyage} gapAdjustments={gapAdjustments} editorial={editorial}/></div></div></div>;
