import React from 'react';
import { VoyageData } from '../types';
import { GapDisplayAdjustment } from '../project/nlroute';
import { EditorialMapPreview } from './EditorialMapPreview';
import { ExportStudio } from './ExportStudio';

type Props = { voyage: VoyageData; gapAdjustments: GapDisplayAdjustment[] };

export const EditorialExportView: React.FC<Props> = ({ voyage, gapAdjustments }) => (
  <div className="w-full h-full overflow-y-auto bg-[#f4f1e9] p-6">
    <div className="max-w-6xl mx-auto space-y-5">
      <EditorialMapPreview voyage={voyage} gapAdjustments={gapAdjustments}/>
      <ExportStudio voyage={voyage}/>
    </div>
  </div>
);
