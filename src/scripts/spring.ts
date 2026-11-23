export type Spring = {
  value: number;
  velocity: number;
  target: number;
  stiffness: number;
  damping: number;
};

export function step(spring: Spring, dt: number) {
  const force = spring.stiffness * (spring.target - spring.value) - spring.damping * spring.velocity;
  spring.velocity += force * dt;
  spring.value += spring.velocity * dt;
}

export function reset(spring: Spring, value: number) {
  spring.value = spring.target = value;
  spring.velocity = 0;
}
