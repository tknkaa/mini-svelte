<script>
  let counter = 5;
  let foo = 5;
  const increment = () => counter++;
  const decrement = () => counter--;
  const incrementFoo = () => foo++;
  
  $: double = counter * 2;

</script>

<div>counter = {counter}</div>
<div>double = {double}</div>
<div>foo = {foo}</div>
<button on:click={decrement}>Decrement</button>
<button on:click={increment}>Increment</button>
<button on:click={incrementFoo}>Increment Foo</button>
