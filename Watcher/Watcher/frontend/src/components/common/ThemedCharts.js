import React, { useContext, useMemo } from 'react';
import {
    Bar as RawBar,
    Doughnut as RawDoughnut,
    HorizontalBar as RawHorizontalBar,
    Line as RawLine,
} from 'react-chartjs-2';
import { ThemeContext } from '../../contexts/ThemeContext';
import { applyChartDefaults, resolveTokens } from './chartTheme';

// Drop-in replacements for the react-chartjs-2 components: resolve colour tokens against
// the active theme and redraw when the theme stylesheet changes.
const themed = Chart => {
    const ThemedChart = ({ data, options, ...rest }) => {
        const theme = useContext(ThemeContext);
        const version = theme ? `${theme.currentTheme}:${theme.themeVersion}` : 'default';
        applyChartDefaults(version);

        const resolvedData = useMemo(
            () => (typeof data === 'function' ? canvas => resolveTokens(data(canvas)) : resolveTokens(data)),
            [data, version]
        );
        const resolvedOptions = useMemo(() => resolveTokens(options), [options, version]);

        return <Chart key={version} data={resolvedData} options={resolvedOptions} {...rest} />;
    };
    ThemedChart.displayName = `Themed(${Chart.displayName || Chart.name || 'Chart'})`;
    return ThemedChart;
};

export const Bar = themed(RawBar);
export const Doughnut = themed(RawDoughnut);
export const HorizontalBar = themed(RawHorizontalBar);
export const Line = themed(RawLine);
