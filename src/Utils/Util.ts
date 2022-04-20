export function catchError<T>(promiseLike: () => Promise<T>): Promise<[Error, T]> {
    return new Promise((resolve) => {
        promiseLike().then(
            (d) => resolve([null, d]),
            (e) => resolve([e, null])
        );
    });
}

export function noop() {} // eslint-disable-line @typescript-eslint/no-empty-function

export function wait(duration: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, duration).unref();
    });
}

export function randomId() {
    return `${Date.now()}::${Math.random().toString(32)}`;
}
