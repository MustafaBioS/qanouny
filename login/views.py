from django.shortcuts import render

# Create your views here.

def login(request):
    return render_template(request, "login/login.html")

def signup(request):
    return render_template(request, "signup/signup.html")