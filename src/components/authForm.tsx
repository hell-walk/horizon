"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { signIn, signUp } from "@/lib/actions/user.action";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import CustomInput from "./customInput";
import { authFormSchema } from "@/lib/utils";
import { useRouter } from "next/navigation";
import PlaidLink from "./plaidLink";
import SetuLink from "./setuLink";
import ImportStatement from "./importStatement";

const AuthForm = ({ type }: { type: string }) => {
    const router = useRouter()
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const formSchema = authFormSchema(type);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            email: "",
            password: "",
        },
    });

    const onSubmit = async (data: z.infer<typeof formSchema>) => {
        // Honeypot: real users never fill the hidden field, bots usually do.
        const trap = (document.getElementById("company-website") as HTMLInputElement | null)?.value;
        if (trap) return;

        setIsLoading(true);
        setErrorMessage(null);

        try {
            // Sigh Up With Appwrite & create plaid token

            if (type === 'sign-up') {

                const userData = {
                    firstName: data.firstName!,
                    lastName: data.lastName!,
                    address1: data.address1!,
                    city: data.city!,
                    state: data.state!,
                    postalCode: data.postalCode!,
                    dateOfBirth: data.dob!,
                    ssn: data.ssn!,
                    email: data.email!,
                    password: data.password!
                }
                const newUser = await signUp(userData)

                if (!newUser) setErrorMessage("We could not create your account. Check the details and try again.");
                setUser(newUser)
            }
            if (type === 'sign-in') {
                const response = await signIn({
                    email: data.email,
                    password: data.password,
                })

                if (response) router.push('/')
                else setErrorMessage("Invalid email or password.");

            }
        } catch (error) {
            console.error(error);
            setErrorMessage("Something went wrong. Please try again.");
        } finally {
            setIsLoading(false);
        }


    }

    return (
        <section className="auth-form">
            <header className="flex flex-col gap-5 md:gap-8">
                <Link href="/" className="flex cursor-pointer items-center gap-1">
                    <Image
                        src="/icons/logo.svg"
                        width={34}
                        height={34}
                        alt="Horizon logo"
                        className="size-[24px] max-xl:size-14"
                    />
                </Link>
                <div className="flex flex-col gap-1 md:gap-3">
                    <h1 className="text-24 lg:text-36 font-semibold text-gray-900">
                        {user ? "Link Account" : type === "sign-in" ? "Sign In" : "Sign Up"}
                    </h1>
                    <p className="text-16 font-normal text-gray-600">
                        {user
                            ? "Link your account to get started"
                            : "Please enter your details"}
                    </p>
                </div>
            </header>

            {user ? (
                <div className="flex flex-col gap-4">
                    <PlaidLink user={user} variant='primary' />
                    <SetuLink user={user} variant="primary" />
                    <ImportStatement variant="primary" />
                </div>
            ) : (
                <>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                            {type === "sign-up" && (
                                <>
                                    <div className="flex gap-4">
                                        <CustomInput
                                            control={form.control}
                                            name="firstName"
                                            label="First Name"
                                            placeholder="Enter your first name"
                                        />
                                        <CustomInput
                                            control={form.control}
                                            name="lastName"
                                            label="Last Name"
                                            placeholder="Enter your last name"
                                        />
                                    </div>
                                    <CustomInput
                                        control={form.control}
                                        name="address1"
                                        label="Address"
                                        placeholder="Enter your specific address"
                                    />
                                    <CustomInput
                                        control={form.control}
                                        name="city"
                                        label="City"
                                        placeholder="Enter your City"
                                    />

                                    <div className="flex gap-4">
                                        <CustomInput
                                            control={form.control}
                                            name="state"
                                            label="State"
                                            placeholder="Example: DL"
                                        />
                                        <CustomInput
                                            control={form.control}
                                            name="postalCode"
                                            label="Postal Code"
                                            placeholder="Example: 201002"
                                        />
                                    </div>
                                    <div className="flex gap-4">
                                        <CustomInput
                                            control={form.control}
                                            name="dob"
                                            label="Date of Birth"
                                            placeholder="YYYY-MM-DD"
                                        />
                                        <CustomInput
                                            control={form.control}
                                            name="ssn"
                                            label="SSN"
                                            placeholder="Example: 1234"
                                        />
                                    </div>
                                </>
                            )}

                            <CustomInput
                                control={form.control}
                                name="email"
                                label="Email"
                                placeholder="Enter your email"
                            />
                            <CustomInput
                                control={form.control}
                                name="password"
                                label="Password"
                                placeholder="Enter your password"
                            />

                            <input
                                id="company-website"
                                name="company-website"
                                type="text"
                                tabIndex={-1}
                                autoComplete="off"
                                aria-hidden="true"
                                className="hidden"
                            />

                            {errorMessage && (
                                <p className="form-message" role="alert">
                                    {errorMessage}
                                </p>
                            )}

                            <div className="flex flex-col gap-4">
                                <Button type="submit" disabled={isLoading} className="form-btn">
                                    {isLoading ? (
                                        <>
                                            <Loader2 size={20} className="animate-spin" /> &nbsp;
                                            Loading...
                                        </>
                                    ) : type === "sign-in" ? (
                                        "Sign In"
                                    ) : (
                                        "Sign Up"
                                    )}
                                </Button>
                            </div>
                        </form>
                    </Form>

                    <footer className="flex justify-center gap-1">
                        <p className="text-14 font-normal text-gray-600">
                            {type === "sign-in"
                                ? "Don't have an account?"
                                : "Already have an account?"}
                        </p>
                        <Link
                            href={type === "sign-in" ? "/sign-up" : "/sign-in"}
                            className="form-link"
                        >
                            {type === "sign-in" ? "Sign up" : "Sign in"}
                        </Link>
                    </footer>
                </>
            )}
        </section>
    );
};

export default AuthForm;
