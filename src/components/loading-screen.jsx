import { TextShimmerWave } from '@/components/loading-ui/text-shimmer-wave';

export function LoadingScreen() {
    return (
        <div
            className="absolute inset-0 z-50 flex flex-col items-center justify-center overflow-hidden px-4 py-5"
            style={{ backgroundColor: '#c6fe69' }}
        >
            <div
                className="relative z-10 flex w-full items-center justify-center text-center"
                style={{ color: '#212631' }}
            >
                <TextShimmerWave className="whitespace-nowrap text-[clamp(1.75rem,8vw,3.25rem)] font-normal leading-tight">
                    LOADING
                </TextShimmerWave>
            </div>
        </div>
    );
}
